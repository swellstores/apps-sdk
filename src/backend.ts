import { requireString, validateUrl } from './context.js';
import type { SwellRequestContext } from './request-context.js';
import { SwellError } from './error.js';
import { validateWorkflowParams } from './workflow.js';
import { USER_AGENT } from './version.js';

export type SwellData = Record<string, any>;
export type BackendOptions = {
  context: SwellRequestContext;
  storeId?: never; apiHost?: never; accessToken?: never; secretKey?: never; appId?: never; requestId?: never;
} | ({
  context?: never; storeId: string; apiHost: string; appId?: string; requestId?: string;
} & ({ accessToken: string; secretKey?: never } | { secretKey: string; accessToken?: never }));
/** Envelope of an ordinary paginated backend list. `page: false` and aggregations return other shapes. */
export interface SwellCollection<T = SwellData> {
  results: T[];
  count: number;
  page: number;
  page_count: number;
  limit: number;
  pages?: Record<string, { start: number; end: number }>;
}
export interface TransactionOperation { method: string; url: string; data?: any }
export interface TransactionOptions {
  /** Opt in to retries: limit counts additional attempts (default 3); base/max are ms (100/5000); jitter defaults to true. */
  retry?: true | { limit?: number; base?: number; max?: number; jitter?: boolean };
}

// Matches JSON bodies: undefined values are omitted and Dates become ISO strings.
function queryParts(query: SwellData, prefix = ''): string[] {
  return Object.entries(query).flatMap(([key, value]) => {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined) return [];
    // A bare key decodes to native null on the server; `key=null` would be the string "null".
    if (value === null) return [encodeURIComponent(name)];
    if (value instanceof Date) value = value.toISOString();
    return typeof value === 'object' ? queryParts(value, name)
      : [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  });
}

/** Backend client from a frontend request context or explicit server credentials. */
export class SwellBackendAPI {
  #baseUrl: string;
  #authorization: string;
  #appId?: string;
  #requestId?: string;
  protected get userAgent(): string { return USER_AGENT; }
  readonly workflows = {
    /** Creates a workflow instance. Optional params must be JSON-safe and at most 128 KiB of UTF-8 JSON; invalid params reject. */
    create: async (name: string, params?: unknown): Promise<SwellData> => {
      const data: SwellData = { workflow_name: name };
      if (params !== undefined) data.params = validateWorkflowParams(params);
      return this.post('/:workflows/instances', data);
    },
  };
  readonly functions = {
    /**
     * Invokes an app's private function from server code and resolves to its response payload,
     * without the envelope's status or headers.
     * `appId` is the app identifier from the request context (`context.appId`).
     * `method` (default `post`) selects the function's handler. GET data reaches the function
     * as query parameters, so its values must be flat strings, numbers or booleans.
     * Throws `SwellError` when the function reports a non-2xx status or an error.
     * Callers authorize the operation first; no caller headers are forwarded.
     */
    call: async <T = SwellData>(appId: string, name: string, data?: SwellData, { method = 'post' }: { method?: 'get' | 'post' | 'put' | 'delete' } = {}): Promise<T> => {
      requireString(appId, 'appId');
      requireString(name, 'function name');
      if (!['get', 'post', 'put', 'delete'].includes(method)) throw new Error(`Invalid function method: ${method}`);
      if (method === 'get' && data && Object.values(data).some(value => !['string', 'number', 'boolean'].includes(typeof value))) {
        throw new Error('GET function data must contain only string, number or boolean values');
      }
      const result = await this.put<any>(`/:functions/${encodeURIComponent(`app.${appId}.${name}`)}`, { $call: { data: data ?? {}, method } });
      if (!result || typeof result !== 'object') throw new SwellError(`Function not found: ${name}`, { status: 404 });
      const { status, error, code, response } = result;
      if (error !== undefined || (typeof status === 'number' && (status < 200 || status > 299))) {
        const message = typeof error === 'string' ? error : typeof response?.error === 'string' ? response.error : `Function ${name} failed`;
        const failure = new SwellError(message, { status, code });
        failure.body = response ?? result;
        throw failure;
      }
      return response;
    },
  };

  constructor(options: BackendOptions) {
    if ('headers' in options) throw new Error('Pass a request context or explicit credentials, not raw headers');
    if (options.context && ['storeId', 'apiHost', 'accessToken', 'secretKey', 'appId', 'requestId'].some(key => key in options)) {
      throw new Error('context and explicit backend credentials are mutually exclusive');
    }
    const config = options.context ?? options;
    const secretKey = 'secretKey' in config ? config.secretKey : undefined;
    requireString(config.storeId, 'storeId');
    if ((config.accessToken !== undefined) === (secretKey !== undefined)) throw new Error('Provide exactly one accessToken or secretKey');
    const credential = config.accessToken ?? secretKey;
    requireString(credential, 'accessToken or secretKey');
    this.#baseUrl = validateUrl(config.apiHost, 'apiHost');
    const bytes = new TextEncoder().encode(`${config.storeId}:${credential}`);
    this.#authorization = `Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`;
    this.#appId = config.appId;
    this.#requestId = config.requestId;
  }

  async #makeRequest<T>(method: string, path: string, data?: any): Promise<T> {
    // Paths stay on the configured host: '' means '/', spaces are encoded, dot segments are
    // normalized by URL parsing, fragments/backslashes/control characters are rejected.
    if (typeof path !== 'string' || /^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith('//') || /[\\#\x00-\x1f\x7f]/.test(path)) {
      throw new Error('Backend endpoint must be a path on the configured API host');
    }
    const endpointUrl = path.replace(/^\//, '').replaceAll(' ', '%20');
    const headers: Record<string, string> = {
      Authorization: this.#authorization, 'User-Agent': this.userAgent, 'Content-Type': 'application/json',
      ...(this.#requestId ? { 'Swell-Request-ID': this.#requestId } : {}),
    };
    const init: RequestInit = { method, headers, redirect: 'manual' };
    let query = '';
    if (data) {
      try {
        if (method !== 'GET') init.body = JSON.stringify(data);
        else {
          const params = queryParts(data).join('&');
          if (params) query = `${path.includes('?') ? '&' : '?'}${params}`;
        }
      } catch { throw new Error(`Error serializing data: ${data}`); }
    }
    const response = await fetch(`${this.#baseUrl}/${endpointUrl}${query}`, init);
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { result = text.trim(); }
    if (!response.ok) throw new SwellError(result, { status: response.status, method, endpointUrl });
    if (method !== 'GET' && result?.errors) throw new SwellError(result.errors, { status: 400, method, endpointUrl });
    return result;
  }

  get<T = SwellData>(path: string, query?: SwellData): Promise<T> { return this.#makeRequest('GET', path, query); }
  put<T = SwellData>(path: string, data?: any): Promise<T> { return this.#makeRequest('PUT', path, data); }
  post<T = SwellData>(path: string, data?: any): Promise<T> { return this.#makeRequest('POST', path, data); }
  delete<T = SwellData>(path: string, data?: any): Promise<T> { return this.#makeRequest('DELETE', path, data); }

  /** Reads installed-app settings; defaults to the configured app ID and rejects when neither ID is supplied. */
  async settings<T = SwellData>(appId = this.#appId): Promise<T> {
    requireString(appId, 'appId for settings()');
    return this.get(`/settings/${encodeURIComponent(appId)}`);
  }

  /** Atomic operations returning results in operation order; only conflicts and throttling retry, and only when requested. */
  async transaction(ops: TransactionOperation[], options: TransactionOptions = {}): Promise<any[]> {
    const cfg = { limit: 3, base: 100, max: 5000, jitter: true, ...(options.retry === true ? {} : options.retry) };
    let attempt = 0;
    while (true) {
      try { return await this.post('/:transaction', ops); }
      catch (error) {
        if (!options.retry || !(error instanceof SwellError) || !error.isRetryable || attempt >= cfg.limit) throw error;
        const delay = Math.min(cfg.base * 2 ** attempt, cfg.max);
        await new Promise(resolve => setTimeout(resolve, cfg.jitter ? delay * (0.5 + Math.random() * 0.5) : delay));
        attempt++;
      }
    }
  }
}
