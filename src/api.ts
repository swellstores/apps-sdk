import SwellJS from 'swell-js';
import qs from 'qs';
import { toBase64 } from './utils';
import { Cache } from './cache';
import { CACHE_TIMEOUT_RESOURCES } from './resources';
export * from './resources';

import type {
  SwellAppConfig,
  SwellErrorOptions,
  SwellMenu,
  SwellData,
  CFThemeEnv,
} from '../types/swell';

const DEFAULT_API_HOST = 'https://api.schema.io';
const CACHE_TIMEOUT = 1000 * 60; // 1m
const SWELL_CLIENT_HEADERS = [
  'swell-store-id',
  'swell-environment-id',
  'swell-app-id',
  'swell-app-version',
  'swell-theme-id',
  'swell-theme-version',
  'swell-theme-branch-id',
  'swell-theme-config-version',
  'swell-public-key',
  'swell-admin-url',
  'swell-vault-url',
  'swell-deployment-mode',
  'swell-request-id',
];

export class Swell {
  public url: URL;
  public headers: SwellData;
  public swellHeaders: SwellData;
  public queryParams: SwellData;
  public workerEnv?: CFThemeEnv;

  // Represents the swell.json app config
  public config?: SwellAppConfig;

  // Represents the Swell Backend API
  public backend?: SwellBackendAPI;

  // Represends the Swell Storefront API
  public storefront: typeof SwellJS;

  // A unique identifier for the current storefront app + environment being served
  // Used to isolate cache between different storefronts
  public instanceId: string = '';

  // Indicates the storefront is in a preview mode
  public isPreview: boolean = false;

  // Indicates the storefront is being used in an editor UI
  public isEditor: boolean = false;

  // Indicates the server response was sent to avoid mutating cookies
  public sentResponse: boolean = false;

  // Local cache for Swell storefront data
  static cache: Map<string, Cache> = new Map();

  constructor(params: {
    url: URL | string;
    config?: SwellAppConfig;
    headers?: SwellData;
    swellHeaders?: SwellData;
    serverHeaders?: Headers | SwellData; // Required on the server
    queryParams?: URLSearchParams | SwellData;
    workerEnv?: any;
    getCookie?: (name: string) => string | undefined;
    setCookie?: (name: string, value: string, options: any) => void;
    [key: string]: any;
  }) {
    const {
      url,
      config,
      headers,
      swellHeaders,
      serverHeaders,
      queryParams,
      workerEnv,
      ...clientProps
    } = params;

    this.url = url instanceof URL ? url : new URL(url || '');

    this.config = config;

    this.queryParams = Swell.formatQueryParams(
      queryParams || this.url.searchParams,
    );

    this.workerEnv = workerEnv;

    if (serverHeaders) {
      const { headers, swellHeaders } = Swell.formatHeaders(serverHeaders);

      this.headers = headers;
      this.swellHeaders = swellHeaders;

      this.backend = new SwellBackendAPI({
        storeId: swellHeaders['store-id'],
        accessToken: swellHeaders['access-token'],
        apiHost: swellHeaders['api-host'],
      });

      this.storefront = this.getStorefrontInstance({
        ...params,
        headers,
        swellHeaders,
      });

      this.instanceId = [
        'store-id',
        'environment-id',
        'deployment-mode',
        'theme-id',
        'theme-branch-id',
      ]
        .map((key) => swellHeaders[key])
        .join('|');

      this.isEditor =
        clientProps.isEditor ?? swellHeaders['deployment-mode'] === 'editor';
      this.isPreview =
        this.isEditor || swellHeaders['deployment-mode'] === 'preview';

      // Clear cache if header changed
      if (swellHeaders['cache-modified']) {
        const cacheModified = this.getCachedSync('_cache-modified');
        if (cacheModified !== swellHeaders['cache-modified']) {
          this.clearCache();
        }

        this.getCacheInstance().set(
          '_cache-modified',
          swellHeaders['cache-modified'],
        );
      }
    } else if (headers && swellHeaders) {
      // Set props from cache, typically used when hydrating client-side
      Object.assign(this, clientProps);

      if (clientProps.cache) {
        this.setCacheValues(clientProps.cache);
      }

      this.headers = headers;
      this.swellHeaders = swellHeaders;

      this.storefront = this.getStorefrontInstance(params);
    } else {
      throw new Error(
        'Swell client requires `serverHeaders` when initialized on the server-side, or `headers` and `swellHeaders` when initialized on the client-side.',
      );
    }
  }

  static formatHeaders(serverHeaders?: Headers | SwellData): {
    headers: SwellData;
    swellHeaders: SwellData;
  } {
    let headers: SwellData = {};
    const swellHeaders: SwellData = {};

    if (serverHeaders instanceof Headers) {
      serverHeaders.forEach((value: string, key: string) => {
        headers[key] = value;
      });
    } else if (serverHeaders) {
      headers = serverHeaders;
    }

    for (const key in headers) {
      if (key.startsWith('swell-')) {
        swellHeaders[key.replace('swell-', '')] = headers[key] || '';
      }
    }

    return { headers, swellHeaders };
  }

  static formatQueryParams(
    queryParams?: URLSearchParams | SwellData,
  ): SwellData {
    let params: SwellData = {};

    if (queryParams instanceof URLSearchParams) {
      params = qs.parse(queryParams.toString());
    } else if (queryParams) {
      params = queryParams;
    }

    return params;
  }

  getClientProps() {
    const clientHeaders = SWELL_CLIENT_HEADERS.reduce((acc, key) => {
      acc[key] = this.headers[key];
      return acc;
    }, {} as SwellData);

    const clientSwellHeaders = SWELL_CLIENT_HEADERS.reduce((acc, key) => {
      const swellKey = key.replace('swell-', '');
      acc[swellKey] = this.swellHeaders[swellKey];
      return acc;
    }, {} as SwellData);

    const storefrontSettings = this.storefront.settings as any;

    return {
      url: this.url,
      headers: clientHeaders,
      swellHeaders: clientSwellHeaders,
      queryParams: this.queryParams,
      instanceId: this.instanceId,
      isPreview: this.isPreview,
      isEditor: this.isEditor,
      cache: this.getCacheInstance().getValues(),
      storefrontSettingStates: {
        state: storefrontSettings.state,
        menuState: storefrontSettings.menuState,
        paymentState: storefrontSettings.paymentState,
        subscriptionState: storefrontSettings.subscriptionState,
        sessionState: storefrontSettings.sessionState,
      },
    };
  }

  getStorefrontInstance(params: SwellData) {
    const { swellHeaders, getCookie, setCookie, storefrontSettingStates } =
      params;

    const storefront = SwellJS.create(
      swellHeaders['store-id'],
      swellHeaders['public-key'],
      {
        url: swellHeaders['admin-url'],
        vaultUrl: swellHeaders['vault-url'],
        getCookie,
        setCookie:
          setCookie &&
          ((name: string, value: string, options: any) =>
            setCookie(name, value, options, this)),
        headers: {
          'Swell-Store-id': swellHeaders['store-id'],
          'Swell-Storefront-Id': swellHeaders['storefront-id'],
        },
      },
    );

    if (storefrontSettingStates) {
      Object.assign(storefront.settings, storefrontSettingStates);
    }

    storefront.request = this.getCacheableStorefrontRequestHandler(
      storefront,
    ) as typeof storefront.request;

    return storefront;
  }

  isStorefrontRequestCacheable(method: string, url: string) {
    if (method === 'get') {
      const urlModel = url.split('/')[1];
      return ['products', 'categories', 'content', 'settings'].includes(
        urlModel,
      );
    }
    return false;
  }

  getCacheableStorefrontRequestHandler(storefront: typeof SwellJS) {
    const storefrontRequest = storefront.request;

    return (
      method: string,
      url: string,
      id: any = undefined,
      data: any = undefined,
      opt: any = undefined,
    ) => {
      if (this.isStorefrontRequestCacheable(method, url)) {
        return this.getCached(
          'swell',
          [method, url, id, data, opt],
          () => {
            return storefrontRequest(method, url, id, data, opt);
          },
          CACHE_TIMEOUT_RESOURCES,
        );
      }

      return storefrontRequest(method, url, id, data, opt);
    };
  }

  getCacheInstance<T>(): Cache<T> {
    let cacheInstance = Swell.cache.get(this.instanceId);

    if (!cacheInstance) {
      cacheInstance = new Cache<T>(this.workerEnv?.THEME, CACHE_TIMEOUT);
      Swell.cache.set(this.instanceId, cacheInstance);
    }

    return cacheInstance;
  }

  setCacheValues(values: Array<any>) {
    const cacheInstance = new Cache(this.workerEnv?.THEME, CACHE_TIMEOUT);

    cacheInstance.setValues(values);

    Swell.cache.set(this.instanceId, cacheInstance);
  }

  setCachedSync(
    key: string,
    args: Array<unknown>,
    value: unknown,
    timeout?: number,
    isSync: boolean = true,
  ) {
    const cacheKey = `${this.instanceId}:${key}_${JSON.stringify(args || [])}`;
    const cacheInstance = this.getCacheInstance();

    if (isSync) {
      return cacheInstance.setSync(cacheKey, value, timeout);
    }

    return cacheInstance.set(cacheKey, value, timeout);
  }

  getCachedSync<T>(
    key: string,
    args?: Array<any> | (() => Promise<T> | T),
    handler?: () => Promise<T> | T,
    timeout?: number,
    isSync: boolean = true,
  ): Promise<T | undefined> | T | undefined {
    const cacheArgs = typeof args === 'function' ? undefined : args;
    const cacheHandler = typeof args === 'function' ? args : handler;
    const cacheKey = `${this.instanceId}:${key}_${JSON.stringify(cacheArgs)}`;
    const cacheInstance = this.getCacheInstance<T>();

    if (isSync) {
      if (cacheInstance.hasSync(cacheKey)) {
        return cacheInstance.getSync(cacheKey);
      }
      if (cacheHandler) {
        return this.resolveCacheHandler(
          cacheInstance,
          cacheKey,
          cacheHandler,
          timeout,
          isSync,
        );
      }
    } else {
      return cacheInstance.has(cacheKey).then((cacheValue) => {
        if (cacheValue !== undefined) {
          return cacheValue;
        }
        if (cacheHandler) {
          return this.resolveCacheHandler<T>(
            cacheInstance,
            cacheKey,
            cacheHandler,
            timeout,
            isSync,
          );
        }
      });
    }
  }

  resolveCacheHandler<T>(
    cacheInstance: Cache<T>,
    cacheKey: string,
    cacheHandler: () => Promise<T> | T,
    timeout?: number,
    isSync: boolean = true,
  ): Promise<T> | T | undefined {
    let result;

    try {
      result = cacheHandler();

      if (isSync) {
        cacheInstance.setSync(cacheKey, result, timeout);
      } else {
        cacheInstance.set(cacheKey, result, timeout);
      }

      if (result instanceof Promise) {
        result.then((data) => {
          if (isSync) {
            cacheInstance.setSync(cacheKey, data, timeout);
          } else {
            cacheInstance.set(cacheKey, data, timeout);
          }
        });
      }
    } catch (err) {
      console.error(err);
    }

    return result;
  }

  async setCached(
    key: string,
    args: Array<unknown>,
    value: unknown,
    timeout?: number,
  ): Promise<any> {
    return this.setCachedSync(key, args, value, timeout, false);
  }

  async getCached<T>(
    key: string,
    args: Array<unknown> | (() => Promise<T>),
    handler?: () => Promise<T>,
    timeout?: number,
  ): Promise<T | undefined> {
    return this.getCachedSync(key, args, handler, timeout, false);
  }

  async getCachedResource<T>(
    key: string,
    args: Array<unknown> | (() => Promise<T>),
    handler?: () => Promise<T>,
    timeout?: number,
  ): Promise<T | undefined> {
    const requestId = this.swellHeaders['request-id'];
    const resourceArgs =
      typeof args === 'function' ? [requestId] : [requestId, args];
    const resourceHandler = typeof args === 'function' ? args : handler;

    return this.getCachedSync<T>(
      key,
      resourceArgs,
      resourceHandler,
      timeout || CACHE_TIMEOUT_RESOURCES,
    );
  }

  clearCache(): void {
    Swell.cache.delete(this.instanceId);
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

  async getStorefrontSettings(): Promise<SwellData> {
    // Load all settings including menus, payments, etc
    try {
      // Note: Logic pulled from swell.js because we need to pass storefront_id explicitly
      const { settings, menus, payments, subscriptions, session } =
        (await this.storefront.request('get', `/settings/all`)) as any;

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
      console.error(`Swell: unable to load settings (${err})`);
    }

    return this.storefront.settings.get();
  }

  getStorefrontMenus(): SwellMenu[] {
    const menus = (this.storefront.settings as any).getState(
      '/settings/menus',
      'menuState',
    );
    if (!menus || menus instanceof Promise) {
      return [];
    }
    return menus as SwellMenu[];
  }

  async get(
    ...args: Parameters<SwellBackendAPI['get']>
  ): Promise<SwellData | undefined> {
    return this.backend?.get(...args);
  }

  async put(
    ...args: Parameters<SwellBackendAPI['put']>
  ): Promise<SwellData | undefined> {
    return this.backend?.put(...args);
  }

  async post(
    ...args: Parameters<SwellBackendAPI['post']>
  ): Promise<SwellData | undefined> {
    return this.backend?.post(...args);
  }

  async delete(
    ...args: Parameters<SwellBackendAPI['delete']>
  ): Promise<SwellData | undefined> {
    return this.backend?.delete(...args);
  }
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

  async makeRequest(method: string, url: string, data?: object) {
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

  async get(url: string, query?: SwellData): Promise<SwellData> {
    return this.makeRequest('GET', url, query);
  }

  async put(url: string, data: SwellData): Promise<SwellData> {
    return this.makeRequest('PUT', url, data);
  }

  async post(url: string, data: SwellData): Promise<SwellData> {
    return this.makeRequest('POST', url, data);
  }

  async delete(url: string, data?: SwellData): Promise<SwellData> {
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
