import SwellJS from 'swell-js';
import qs from 'qs';

import { Cache, RequestCache, ResourceCache } from './cache';
import { md5, toBase64 } from './utils';

import type {
  SwellApiParams,
  SwellAppConfig,
  SwellErrorOptions,
  SwellMenu,
  SwellData,
  CFThemeEnv,
  SwellAppShopifyCompatibilityConfig,
} from '../types/swell';
import { isLikePromise } from './liquid/utils';

export * from './resources';

const DEFAULT_API_HOST = 'https://api.schema.io';

const resourceCaches = new Map<string, Cache>();
const requestCaches = new Map<string, Cache>();

export class Swell {
  public url: URL;
  public headers: Record<string, string | undefined>;
  public swellHeaders: Record<string, string | undefined>;
  public queryParams: qs.ParsedQs;
  public workerEnv?: CFThemeEnv;

  // Represents the swell.json app config
  public config?: SwellAppConfig;

  // Represents the shopify_compatibility.json app config
  public shopifyCompatibilityConfig?: SwellAppShopifyCompatibilityConfig;

  // Represents the Swell Backend API
  public backend?: SwellBackendAPI;

  // Represends the Swell Storefront API
  public storefront: typeof SwellJS;

  // Contains resources passed from server via request headers.
  public storefrontContext: SwellData;

  // A unique identifier for the current storefront app + environment being served
  // Used to isolate cache between different storefronts
  public instanceId: string = '';

  // Indicates the storefront is in a preview mode
  public isPreview: boolean = false;

  // Indicates the storefront is being used in an editor UI
  public isEditor: boolean = false;

  // Indicates the server response was sent to avoid mutating cookies
  public sentResponse: boolean = false;

  public storefront_url?: string;

  constructor(params: SwellApiParams) {
    const {
      url,
      config,
      shopifyCompatibilityConfig,
      headers,
      swellHeaders,
      serverHeaders,
      queryParams,
      workerEnv,
      ...clientProps
    } = params;

    this.url = url instanceof URL ? url : new URL(url || '');

    this.config = config;

    this.shopifyCompatibilityConfig = shopifyCompatibilityConfig;

    this.queryParams = Swell.formatQueryParams(
      queryParams || this.url.searchParams,
    );

    this.workerEnv = workerEnv;

    console.log(
      `KV cache: ${this.workerEnv?.THEME ? 'enabled' : 'disabled'}`,
    );

    if (serverHeaders) {
      const { headers, swellHeaders } = Swell.formatHeaders(serverHeaders);

      this.headers = headers;
      this.swellHeaders = swellHeaders;

      this.backend = new SwellBackendAPI({
        storeId: swellHeaders['store-id'] as string,
        accessToken: swellHeaders['access-token'] as string,
        apiHost: swellHeaders['api-host'],
      });

      this.storefront = this.getStorefrontInstance({
        ...params,
        headers,
        swellHeaders,
      });

      // Generate a unique namespace for this storefront/theme
      this.instanceId = [
        'store-id',
        'environment-id',
        'deployment-mode',
        'theme-id',
        'theme-branch-id',
      ]
        .map((key) => swellHeaders[key] || '0')
        .join(':');

      this.isEditor =
        clientProps.isEditor ?? swellHeaders['deployment-mode'] === 'editor';

      this.isPreview =
        this.isEditor || swellHeaders['deployment-mode'] === 'preview';
    } else if (headers && swellHeaders) {
      // Set props from cache, typically used when hydrating client-side
      Object.assign(this, clientProps);

      this.headers = headers;
      this.swellHeaders = swellHeaders;

      this.storefront = this.getStorefrontInstance(params);
    } else {
      throw new Error(
        'Swell client requires `serverHeaders` when initialized on the server-side, or `headers` and `swellHeaders` when initialized on the client-side.',
      );
    }

    // Init resources sent from the server via request headers.
    this.storefrontContext = this.initStorefrontContext();
  }

  static formatHeaders(
    serverHeaders?: Headers | Record<string, string | undefined>,
  ): {
    headers: Record<string, string | undefined>;
    swellHeaders: Record<string, string | undefined>;
  } {
    let headers: Record<string, string | undefined> = {};
    const swellHeaders: Record<string, string | undefined> = {};

    if (serverHeaders instanceof Headers) {
      serverHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (serverHeaders) {
      headers = serverHeaders;
    }

    for (const [key, value] of Object.entries(headers)) {
      if (key.startsWith('swell-') && value) {
        swellHeaders[key.replace('swell-', '')] = value;
      }
    }

    return { headers, swellHeaders };
  }

  static formatQueryParams(
    queryParams?: URLSearchParams | Record<string, string | undefined>,
  ): qs.ParsedQs {
    let params: qs.ParsedQs = {};

    if (queryParams instanceof URLSearchParams) {
      params = qs.parse(queryParams.toString());
    } else if (queryParams) {
      params = queryParams;
    }

    return params;
  }

  /**
   * Fetches a resource.
   * First attempts to fetch from cache.
   */
  async getCachedResource<T>(
    key: string,
    args: unknown[],
    handler: () => T | Promise<T>,
  ): Promise<T | undefined> {
    const cacheKey = getCacheKey(key, [this.instanceId, args]);
    return this.getResourceCache().fetch<T>(cacheKey, handler);
  }

  async getAppSettings(): Promise<SwellData> {
    const settings = await this.get(
      '/:storefronts/{id}/configs/settings/values',
      {
        id: this.swellHeaders['storefront-id'],
      },
    );

    return settings || {};
  }

  async getStorefrontSettings(force = false): Promise<SwellData> {
    try {
      // Load all settings including menus, payments, etc
      const { settings, menus, payments, subscriptions, session } =
        await this.storefront.request<any>(
          'get',
          '/settings/all',
          undefined,
          undefined,
          { force },
        );

      const storefrontSettings = this.storefront.settings as any;

      storefrontSettings.localizedState = {};

      storefrontSettings.set({
        value: settings,
      });

      storefrontSettings.set({
        model: 'menus',
        value: menus,
      });

      storefrontSettings.set({
        model: 'payments',
        value: payments,
      });

      storefrontSettings.set({
        model: 'subscriptions',
        value: subscriptions,
      });

      storefrontSettings.set({
        model: 'session',
        value: session,
      });
    } catch (err) {
      if (err instanceof Error) {
        err.message = `Swell: unable to load settings (${err.message})`;
      }

      console.error(err);
    }

    return this.storefront.settings.get();
  }

  getStorefrontMenus(): SwellMenu[] {
    const menus = (this.storefront.settings as any).getState(
      '/settings/menus',
      'menuState',
    );

    if (!menus || isLikePromise(menus)) {
      return [];
    }

    return menus;
  }

  getStorefrontLocalization(): { locale: string, currency: string; } {
    const locale = this.storefront.locale.selected();
    const currency = this.storefront.currency.selected();

    if (!locale || isLikePromise(locale)) {
      return { locale: 'en-US', currency: 'USD' };
    }

    return { locale, currency };
  }

  async get<T = SwellData>(
    ...args: Parameters<SwellBackendAPI['get']>
  ): Promise<T | undefined> {
    return this.backend?.get<T>(...args);
  }

  async put<T = SwellData>(
    ...args: Parameters<SwellBackendAPI['put']>
  ): Promise<T | undefined> {
    return this.backend?.put(...args);
  }

  async post<T = SwellData>(
    ...args: Parameters<SwellBackendAPI['post']>
  ): Promise<T | undefined> {
    return this.backend?.post(...args);
  }

  async delete<T = SwellData>(
    ...args: Parameters<SwellBackendAPI['delete']>
  ): Promise<T | undefined> {
    return this.backend?.delete(...args);
  }

  private getStorefrontInstance(params: SwellApiParams) {
    const { swellHeaders, getCookie, setCookie, storefrontSettingStates } =
      params;

    if (!swellHeaders) {
      throw new Error('Swell headers are required');
    }

    const storeId = swellHeaders['store-id'];
    const publicKey = swellHeaders['public-key'];

    if (!storeId || !publicKey) {
      throw new Error(
        'Missing required headers: "swell-store-id" and "swell-public-key"',
      );
    }

    const storefront = SwellJS.create(storeId, publicKey, {
      url: swellHeaders['admin-url'],
      vaultUrl: swellHeaders['vault-url'],
      getCookie,
      setCookie:
        setCookie &&
        ((name: string, value: string, options?: object) =>
          setCookie(name, value, options, this)),
      headers: {
        'Swell-Store-id': storeId,
        'Swell-Storefront-Id': swellHeaders['storefront-id'] as string,
      },
    });

    if (storefrontSettingStates) {
      Object.assign(storefront.settings, storefrontSettingStates);
    }

    storefront.request = this.getCacheableStorefrontRequestHandler(
      storefront,
    ) as typeof storefront.request;

    return storefront;
  }

  /**
   * Initializes resources passed in from the server via request headers.
   */
  private initStorefrontContext(): SwellData {
    let storefrontContext = {} as SwellData;
    if (this.swellHeaders?.['storefront-context']) {
      try {
        storefrontContext = JSON.parse(
          decodeURIComponent(this.swellHeaders['storefront-context']),
        );
      } catch (error) {
        console.error('Failed to parse swell-storefront-context. Ignoring...');
      }
    }
    return storefrontContext;
  }

  private isStorefrontRequestCacheable(
    method: string,
    url: string,
    opt?: { force: boolean },
  ): boolean {
    if (opt?.force) {
      return false;
    }

    if (method === 'get') {
      const urlModel = url.split('/')[1];

      switch (urlModel) {
        case 'products':
        case 'categories':
        case 'content':
        case 'settings':
          return true;

        default:
          return false;
      }
    }

    return false;
  }

  private getCacheableStorefrontRequestHandler<T>(storefront: typeof SwellJS) {
    const storefrontRequest = storefront.request;

    return (method: string, url: string, id?: any, data?: any, opt?: any) => {
      if (this.isStorefrontRequestCacheable(method, url, opt)) {
        return this.getRequestCache().fetchSWR<T>(
          getCacheKey('request', [this.instanceId, method, url, id, data, opt]),
          () => storefrontRequest<T>(method, url, id, data, opt),
        );
      }

      // clear storefront context if we mutate it
      switch (method) {
        case 'delete':
        case 'post':
        case 'put': {
          // put /cart/items
          const contextKey = url.split('/')[1];
          delete this.storefrontContext[contextKey];
          break;
        }

        default:
      }

      return storefrontRequest<T>(method, url, id, data, opt);
    };
  }

  /**
   * Caches client resources in memory.
   */
  private getResourceCache(): Cache {
    let cache = resourceCaches.get(this.instanceId);
    if (!cache) {
      cache = new ResourceCache({ kvStore: this.workerEnv?.THEME });
      resourceCaches.set(this.instanceId, cache);
    }
    return cache;
  }

  /**
   * Caches client storefront API requests in memory.
   */
  private getRequestCache(): Cache {
    let cache = requestCaches.get(this.instanceId);
    if (!cache) {
      cache = new RequestCache({ kvStore: this.workerEnv?.THEME });
      requestCaches.set(this.instanceId, cache);
    }
    return cache;
  }
}

/**
 * Generates a cache key from a root key and any optional arguments.
 */
function getCacheKey(key: string, args?: unknown[]): string {
  let cacheKey = key;
  if (Array.isArray(args) && args.length > 0) {
    cacheKey += `_${JSON.stringify(args)}`;
  }

  // TODO: calculate the number of bytes
  // 512 bytes, maximum key for KV storage
  if (cacheKey.length > 512) {
    // TODO: slice the first 480 bytes instead of the length of the code units
    cacheKey = `${cacheKey.slice(0, 480)}${md5(cacheKey)}`;
  }

  return cacheKey;
}

export class SwellBackendAPI {
  public apiHost: string = DEFAULT_API_HOST;
  public apiAuth: string = '';

  constructor({
    storeId,
    accessToken,
    apiHost,
  }: {
    storeId: string;
    accessToken: string;
    apiHost?: string;
  }) {
    this.apiHost = apiHost || DEFAULT_API_HOST;
    this.apiAuth = toBase64(`${storeId}:${accessToken}`);
  }

  async makeRequest<T>(method: string, url: string, data?: object): Promise<T> {
    const requestOptions: {
      method: string;
      headers: SwellData;
      body?: string;
    } = {
      method,
      headers: {
        Authorization: `Basic ${this.apiAuth}`,
        'User-Agent': 'swell-functions/1.0',
        'Content-Type': 'application/json',
      },
    };

    let query = '';

    if (data) {
      try {
        if (method === 'GET') {
          query = `?${this.stringifyQuery(data)}`;
        } else {
          requestOptions.body = JSON.stringify(data);
          requestOptions.headers['Content-Length'] = String(
            requestOptions.body.length,
          );
        }
      } catch {
        throw new Error(`Error serializing data: ${data}`);
      }
    }

    const endpointUrl = String(url).startsWith('/') ? url.substring(1) : url;
    const requestUrl = `${this.apiHost}/${endpointUrl}${query}`;

    const response = await fetch(requestUrl, requestOptions);

    const responseText = await response.text();

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = String(responseText || '').trim();
    }

    if (response.status > 299) {
      throw new SwellError(result, {
        status: response.status,
        method,
        endpointUrl,
      });
    } else if (method !== 'GET' && result?.errors) {
      throw new SwellError(result.errors, { status: 400, method, endpointUrl });
    }

    return result;
  }

  stringifyQuery(queryObject: object, prefix?: string): string {
    const result = [];

    for (const [key, value] of Object.entries(queryObject)) {
      const prefixKey = prefix ? `${prefix}[${key}]` : key;
      const isObject = value !== null && typeof value === 'object';
      const encodedResult = isObject
        ? this.stringifyQuery(value, prefixKey)
        : `${encodeURIComponent(prefixKey)}=${
            value === null ? '' : encodeURIComponent(value)
          }`;

      result.push(encodedResult);
    }

    return result.join('&');
  }

  async get<T = SwellData>(url: string, query?: SwellData): Promise<T> {
    return this.makeRequest('GET', url, query);
  }

  async put<T = SwellData>(url: string, data: SwellData): Promise<T> {
    return this.makeRequest('PUT', url, data);
  }

  async post<T = SwellData>(url: string, data: SwellData): Promise<T> {
    return this.makeRequest('POST', url, data);
  }

  async delete<T = SwellData>(url: string, data?: SwellData): Promise<T> {
    return this.makeRequest('DELETE', url, data);
  }
}

export class SwellError extends Error {
  status: number = 200;

  constructor(message: string, options: SwellErrorOptions = {}) {
    let formattedMessage;
    if (typeof message === 'string') {
      formattedMessage = message;
    } else {
      formattedMessage = JSON.stringify(message, null, 2);
    }

    if (options.method && options.endpointUrl) {
      formattedMessage = `${options.method} /${options.endpointUrl}\n${formattedMessage}`;
    }

    super(formattedMessage);
    this.name = 'SwellError';
    this.status = options.status || 500;
  }
}
