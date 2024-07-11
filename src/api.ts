import SwellJS from 'swell-js';
import qs from 'qs';
import { toBase64 } from './utils';
import { CACHE_TIMEOUT_RESOURCES } from './resources';
export * from './resources';

const DEFAULT_API_HOST = 'https://api.schema.io';
const CACHE_TIMEOUT = 1000 * 60 * 15; // 15m
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

  // Indicates the storefront is in a development mode (preview and/or editor)
  public isDevelopment: boolean = false;

  // Indicates the server response was sent to avoid mutating cookies
  public sentResponse: boolean = false;

  // Local cache for Swell storefront data
  static cache: Map<string, any> = new Map();

  constructor(params: {
    url: URL | string;
    config?: SwellAppConfig;
    headers?: SwellData;
    swellHeaders?: SwellData;
    serverHeaders?: Headers | SwellData; // Required on the server
    queryParams?: URLSearchParams | SwellData;
    getCookie?: (name: string) => string;
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
      ...clientProps
    } = params;

    this.url = url instanceof URL ? url : new URL(url || '');

    this.config = config;

    this.queryParams = Swell.formatQueryParams(
      queryParams || this.url.searchParams,
    );

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

      this.isPreview =
        clientProps.isEditor || swellHeaders['deployment-mode'] === 'preview';
      this.isEditor =
        clientProps.isEditor ?? swellHeaders['deployment-mode'] === 'editor';

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

    this.isDevelopment = this.isPreview || this.isEditor;
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

    const storefrontSettings = this.storefront.settings;

    return {
      url: this.url,
      headers: clientHeaders,
      swellHeaders: clientSwellHeaders,
      queryParams: this.queryParams,
      instanceId: this.instanceId,
      isPreview: this.isPreview,
      isEditor: this.isEditor,
      cache: Array.from(this.getCacheInstance()),
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

    // TODO: make a create method to separate instanced of swell.js
    const storefront = SwellJS;

    storefront.init(swellHeaders['store-id'], swellHeaders['public-key'], {
      url: swellHeaders['admin-url'],
      vaultUrl: swellHeaders['vault-url'],
      getCookie,
      setCookie:
        setCookie &&
        ((name: string, value: string, options: any) =>
          setCookie(name, value, options, this)),
    });

    if (storefrontSettingStates) {
      Object.assign(storefront.settings, storefrontSettingStates);
    }

    return storefront;
  }

  getCacheInstance() {
    let cacheInstance = Swell.cache.get(this.instanceId);
    if (!cacheInstance) {
      cacheInstance = new Map();
      Swell.cache.set(this.instanceId, cacheInstance);
    }

    return cacheInstance;
  }

  setCacheValues(values: Array<any>) {
    Swell.cache.set(this.instanceId, new Map(values));
  }

  getCachedSync(
    key: string,
    args?: Array<any> | Function,
    handler?: Function,
    timeout?: number,
  ): any {
    const cacheArgs = typeof args === 'function' ? undefined : args;
    const cacheHandler = typeof args === 'function' ? args : handler;
    const cacheKey = `${this.instanceId}:${key}_${JSON.stringify(cacheArgs)}`;
    const cacheInstance = this.getCacheInstance();

    if (cacheInstance.has(cacheKey)) {
      return cacheInstance.get(cacheKey);
    }

    if (cacheHandler) {
      let result;
      try {
        result = cacheHandler();
        cacheInstance.set(cacheKey, result);

        if (result instanceof Promise) {
          result.then((data) => {
            cacheInstance.set(cacheKey, data);
          });
        }
      } catch (err) {
        console.error(err);
      }

      // Live cache lives longer than preview cache
      setTimeout(
        () => cacheInstance.delete(cacheKey),
        timeout ?? CACHE_TIMEOUT,
      );

      return result;
    }
  }

  async getCached(
    key: string,
    args: Array<any> | Function,
    handler?: Function,
    timeout?: number,
  ): Promise<any> {
    return await this.getCachedSync(key, args, handler, timeout);
  }

  async getCachedResource(
    key: string,
    args: Array<any> | Function,
    handler?: Function,
    timeout?: number,
  ): Promise<any> {
    const requestId = this.swellHeaders['request-id'];
    const resourceArgs =
      typeof args === 'function' ? [requestId] : [requestId, args];
    const resourceHandler = typeof args === 'function' ? args : handler;

    return await this.getCachedSync(
      key,
      resourceArgs,
      resourceHandler,
      timeout || CACHE_TIMEOUT_RESOURCES,
    );
  }

  clearCache() {
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
        await this.storefront.request(
          'get',
          `/settings/all?storefront_id=${this.swellHeaders['storefront-id']}`,
        );

      this.storefront.settings.localizedState = {};

      this.storefront.settings.set({
        value: settings,
      });

      this.storefront.settings.set({
        model: 'menus',
        value: menus,
      });

      this.storefront.settings.set({
        model: 'payments',
        value: payments,
      });

      this.storefront.settings.set({
        model: 'subscriptions',
        value: subscriptions,
      });

      this.storefront.settings.set({
        model: 'session',
        value: session,
      });
    } catch (err) {
      console.error(`Swell: unable to load settings (${err})`);
    }

    return this.storefront.settings.get();
  }

  getStorefrontMenus(): SwellMenu[] {
    const menus = this.storefront.settings.getState(
      '/settings/menus',
      'menuState',
    );
    if (!menus || menus instanceof Promise) {
      return [];
    }
    return menus as SwellMenu[];
  }

  get(
    ...args: Parameters<SwellBackendAPI['get']>
  ): Promise<SwellData> | undefined {
    return this.backend?.get(...args);
  }

  put(
    ...args: Parameters<SwellBackendAPI['put']>
  ): Promise<SwellData> | undefined {
    return this.backend?.put(...args);
  }

  post(
    ...args: Parameters<SwellBackendAPI['post']>
  ): Promise<SwellData> | undefined {
    return this.backend?.post(...args);
  }

  delete(
    ...args: Parameters<SwellBackendAPI['delete']>
  ): Promise<SwellData> | undefined {
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
