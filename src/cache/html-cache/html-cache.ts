import { md5 } from '../../utils';
import { logger, createTraceId } from '../../utils/logger';

import type { CacheBackend, CachedEntry } from './html-cache-backend';

const CACHE_KEY_ORIGIN = 'https://cache.swell.store';

/**
 * Configuration for path-specific cache behavior.
 *
 * Paths support wildcards:
 *   - `*` matches any characters except `/`
 *   - `**` matches any characters including `/`
 *
 * Examples: `/account/*`, `/api/**`, `*.json`
 *
 * First matching rule wins.
 */
export interface PathRule {
  path: string;
  /** Time-to-live in seconds */
  ttl?: number;
  /** Stale-while-revalidate in seconds */
  swr?: number;
  /** If true, skip caching for this path */
  skip?: boolean;
  /**
   * Optional list of allowed Content-Types for caching.
   *
   * If provided, responses whose Content-Type starts with one of these values are cacheable.
   *
   * If omitted, defaults to only allowing `text/html`.
   */
  contentTypes?: string[];
}

export interface CacheRules {
  defaults: {
    live: { ttl: number; swr: number };
    preview: { ttl: number; swr: number };
  };
  pathRules?: PathRule[];
}

export const DEFAULT_CACHE_RULES: CacheRules = {
  defaults: {
    live: { ttl: 20, swr: 60 * 60 * 24 * 7 }, // 20s TTL, 1 week SWR
    preview: { ttl: 10, swr: 60 * 60 * 24 * 7 }, // 10s TTL, 1 week SWR
  },
  pathRules: [{ path: '/checkout/*', skip: true }],
};

interface PathRuleInner extends PathRule {
  regex: RegExp;
}

interface CacheRulesInner {
  defaults: {
    live: { ttl: number; swr: number };
    preview: { ttl: number; swr: number };
  };
  pathRules?: PathRuleInner[];
}

type DeploymentMode = 'live' | 'preview';

export interface CacheResult {
  found: boolean;
  stale?: boolean;
  response?: Response;
  cacheable?: boolean;
  age?: number;
  notModified?: boolean;
  conditional304?: Response;
}

const SANITIZE_CLIENT_HEADERS = Object.freeze([
  'connection',
  'proxy-connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'via',
  'alt-svc',
  'content-length',
  'content-encoding',
  // Also strip any legacy internal metadata keys
  'x-original-ttl',
  'x-original-swr',
  'x-cache-time',
]);

const CACHE_KEY_HEADERS = Object.freeze([
  'cookie',
  'swell-storefront-id',
  'swell-app-id',
  'swell-access-token',
  'swell-theme-version-hash',
  'swell-cache-modified',
  'x-locale',
  'swell-storefront-context',
]);

/**
 * Contains all the storage-agnostic HTML caching logic.
 * It determines what to cache, for how long, how to build cache keys,
 * and how to construct client responses, while delegating the actual
 * read/write operations to a pluggable backend.
 */
export class HtmlCache {
  protected epoch: string;
  protected backend: CacheBackend;
  protected cacheRules: CacheRulesInner;

  constructor(
    epoch: string,
    backend: CacheBackend,
    cacheRules: CacheRules = DEFAULT_CACHE_RULES,
  ) {
    this.epoch = epoch;
    this.backend = backend;

    this.cacheRules = {
      ...cacheRules,
      pathRules: cacheRules.pathRules?.map((rule) => ({
        ...rule,
        regex: this.convertPathToRegex(rule.path),
      })),
    };
  }

  /**
   * Converts wildcard pattern to regex and tests against path.
   *
   * - `*` matches any characters except `/`
   * - `**` matches any characters including `/`
   */
  protected convertPathToRegex(pattern: string): RegExp {
    // Escape special regex chars except * and /
    const regex = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*\*/g, '___DOUBLE_STAR___') // Temporarily replace **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/___DOUBLE_STAR___/g, '.*'); // ** matches anything

    return new RegExp(`^${regex}$`);
  }

  async get(request: Request): Promise<CacheResult | null> {
    const trace = createTraceId();

    if (!this.canReadFromCache(request)) {
      logger.debug('[SDK Html-cache] non-cacheable request', { trace });
      return { found: false, cacheable: false };
    }

    try {
      const cacheKey = this.buildCacheKey(request);
      const entry = await this.backend.read(cacheKey);

      if (!entry) {
        logger.debug('[SDK Html-cache] cacheable, MISS', { trace });
        return { found: false, cacheable: true };
      }

      const age = this.getEntryAge(entry);
      const { ttl, swr } = entry;

      const isStale = age >= ttl;
      const isExpired = age >= ttl + swr;

      if (!isExpired) {
        logger.debug('[SDK Html-cache] cacheable, HIT', {
          stale: isStale,
          age,
          trace,
        });

        const clientResponse = this.buildClientResponse(entry, isStale, age);

        return {
          found: true,
          stale: isStale,
          response: clientResponse,
          cacheable: true,
          age: Math.floor(age),
        };
      }

      logger.debug('[SDK Html-cache] cacheable, hit, expired', { trace });
      return { found: false, cacheable: true };
    } catch (e) {
      logger.warn('[SDK Html-cache] get failed', {
        trace,
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  async getWithConditionals(request: Request): Promise<CacheResult | null> {
    const result = await this.get(request);

    if (!result?.found || result.stale) {
      return result;
    }

    const ifModifiedSince = request.headers.get('If-Modified-Since');
    const ifNoneMatch = request.headers.get('If-None-Match');

    if ((ifModifiedSince || ifNoneMatch) && result.response) {
      const lastModified = result.response.headers.get('Last-Modified');
      const etag = result.response.headers.get('ETag');

      if (
        this.checkNotModified(ifModifiedSince, ifNoneMatch, lastModified, etag)
      ) {
        result.notModified = true;
        result.conditional304 = new Response(null, {
          status: 304,
          headers: {
            'Last-Modified': lastModified || '',
            ETag: etag || '',
            'Cache-Control': result.response.headers.get('Cache-Control') || '',
            'Cloudflare-CDN-Cache-Control':
              result.response.headers.get('Cloudflare-CDN-Cache-Control') || '',
            'X-Cache-Status': 'HIT-304',
          },
        });
      }
    }

    return result;
  }

  async put(request: Request, response: Response): Promise<void> {
    const trace = createTraceId();

    if (!this.canWriteToCache(request, response)) {
      logger.debug('[SDK Html-cache] put skipped, non-cacheable', { trace });
      return;
    }

    try {
      const cacheKey = this.buildCacheKey(request);
      const ttl = this.getTTLForRequest(request);
      const swr = this.getSWRForRequest(request);
      // Don't clone here - the response passed in is already dedicated for caching
      const body = await response.text();

      if (!body || body.trim().length === 0) {
        logger.warn(
          '[SDK Html-cache] put skipped, empty or minimal response body',
          {
            trace,
            bodyLength: body.length,
          },
        );
        return;
      }

      const date = new Date();
      const headers = this.normalizeHeaders(response.headers);

      const entry: CachedEntry = {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        cacheTimeISO: date.toISOString(),
        ttl,
        swr,
        etag: this.quoteETag(headers['etag'] || md5(body)),
        lastModifiedUTC: headers['last-modified'] || date.toUTCString(),
      };

      const hardExpireSeconds = ttl + swr;

      await this.backend.write(cacheKey, entry, hardExpireSeconds);
      logger.debug('[SDK Html-cache] put done', { trace });
    } catch (e) {
      logger.warn('[SDK Html-cache] put failed', {
        trace,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  public async delete(requestOrKey: Request | string): Promise<void> {
    try {
      const key =
        typeof requestOrKey === 'string'
          ? requestOrKey
          : this.buildCacheKey(requestOrKey);
      if (this.backend.delete) {
        await this.backend.delete(key);
      }
    } catch (e) {
      logger.warn('[SDK Html-cache] delete failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  public canReadFromCache(request: Request): boolean {
    switch (request.method.toUpperCase()) {
      case 'GET':
      case 'HEAD':
        break;

      default:
        return false;
    }

    const res = this.resolvePathRule(request);
    if (res.skip) return false;
    return this.isRequestCacheable(request);
  }

  public canWriteToCache(request: Request, response: Response): boolean {
    const method = request.method.toUpperCase();
    if (method !== 'GET' || !response.ok) return false;
    const res = this.resolvePathRule(request);
    if (res.skip) return false;
    if (!this.isRequestCacheable(request)) return false;
    return this.isResponseCacheable(response, res.rule);
  }

  public createRevalidationRequest(request: Request): Request {
    const headers = new Headers(request.headers);
    headers.set('X-Cache-Bypass', 'revalidation');
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
    headers.delete('Cache-Control');
    headers.delete('Pragma');

    return new Request(request.url, {
      method: 'GET',
      headers,
    });
  }

  protected buildClientResponse(
    entry: CachedEntry,
    isStale: boolean,
    age: number,
  ): Response {
    const headers = new Headers(entry.headers);

    headers.set('Cache-Control', 'public, max-age=1, must-revalidate');
    headers.set(
      'Cloudflare-CDN-Cache-Control',
      `public, s-maxage=${entry.ttl}, stale-while-revalidate=${entry.swr}, stale-if-error=60`,
    );

    if (entry.lastModifiedUTC) {
      headers.set('Last-Modified', entry.lastModifiedUTC);
    }
    if (entry.etag) {
      headers.set('ETag', entry.etag);
    }

    headers.set('X-Cache-Status', isStale ? 'STALE' : 'HIT');
    headers.set('X-Cache-Age', Math.floor(age).toString());

    this.sanitizeClientHeaders(headers);

    return new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers,
    });
  }

  protected buildCacheKey(request: Request): string {
    const url = new URL(request.url);
    const versionHash = this.generateVersionHash(request.headers);
    const normalizedQuery = this.normalizeSearchParams(url.searchParams);
    const cacheKeyPath = `${versionHash}${url.pathname}`;
    const keyUrl = new URL(`${CACHE_KEY_ORIGIN}${cacheKeyPath}`);

    if (normalizedQuery) {
      keyUrl.search = `?${normalizedQuery}`;
    }

    // The full URL string is the logical cache key.
    // Backends can hash it if they have key length limitations.
    return keyUrl.toString();
  }

  protected checkNotModified(
    ifModifiedSince: string | null,
    ifNoneMatch: string | null,
    lastModified: string | null,
    etag: string | null,
  ): boolean {
    if (this.ifNoneMatchMatches(ifNoneMatch, etag)) {
      return true;
    }
    if (ifModifiedSince && lastModified) {
      try {
        const ifModDate = new Date(ifModifiedSince);
        const lastModDate = new Date(lastModified);
        if (
          Number.isNaN(ifModDate.getTime()) ||
          Number.isNaN(lastModDate.getTime())
        ) {
          return false;
        }
        return ifModDate >= lastModDate;
      } catch {
        return false;
      }
    }
    return false;
  }

  protected ifNoneMatchMatches(
    ifNoneMatch: string | null,
    etag: string | null,
  ): boolean {
    if (!ifNoneMatch || !etag) return false;
    const header = ifNoneMatch.trim();
    if (header === '*') return true;
    const tokens = header.split(',').map((t) => t.trim());
    const normalizedEtag = etag.replace(/^W\//, '');

    for (const token of tokens) {
      if (token === etag) return true;
      const normalizedToken = token.replace(/^W\//, '');
      if (normalizedToken === normalizedEtag) return true;
    }
    return false;
  }

  protected quoteETag(value: string): string {
    if (!value) return value;
    if (value.startsWith('"') || value.startsWith('W/"')) return value;
    if (value.startsWith('W/')) return `W/"${value.slice(2)}"`;
    return `"${value}"`;
  }

  protected sanitizeClientHeaders(headers: Headers): void {
    for (const name of SANITIZE_CLIENT_HEADERS) {
      headers.delete(name);
    }
  }

  public getCacheKeyHeaders(headers: Headers): Headers {
    const acc = new Headers();

    for (const name of CACHE_KEY_HEADERS) {
      const value = headers.get(name);

      if (value) {
        acc.set(name, value);
      }
    }

    return acc;
  }

  protected generateVersionHash(headers: Headers): string {
    const swellData = this.extractSwellData(headers.get('cookie'));

    const versionFactors = {
      store: headers.get('swell-storefront-id') || '',
      app: headers.get('swell-app-id') || '',
      auth: headers.get('swell-access-token') || '',
      theme: headers.get('swell-theme-version-hash') || '',
      modified: headers.get('swell-cache-modified') || '',
      currency: (swellData['swell-currency'] as string) || 'USD',
      locale:
        headers.get('x-locale') ||
        (swellData['swell-locale'] as string) ||
        'en-US',
      context: headers.get('swell-storefront-context'),
      epoch: this.epoch,
    };

    return md5(JSON.stringify(versionFactors));
  }

  protected extractSwellData(cookie: string | null): Record<string, unknown> {
    if (!cookie) return {};
    const swellDataMatch = cookie.match(/swell-data=([^;]+)/);
    if (!swellDataMatch) return {};
    try {
      return (
        (JSON.parse(decodeURIComponent(swellDataMatch[1])) as Record<
          string,
          unknown
        >) || {}
      );
    } catch {
      return {};
    }
  }

  protected isRequestCacheable(request: Request): boolean {
    if (request.headers.get('swell-deployment-mode') === 'editor') return false;

    if (request.headers.get('cache-control')?.includes('no-cache'))
      return false;

    // Reject caching if critical headers are missing to prevent cache poisoning
    const storefrontId = request.headers.get('swell-storefront-id');
    const themeVersionHash = request.headers.get('swell-theme-version-hash');

    if (!storefrontId || !themeVersionHash) {
      return false;
    }

    return true;
  }

  protected isResponseCacheable(
    response: Response,
    matchedRule?: PathRule,
  ): boolean {
    const contentType = response.headers.get('content-type') || '';
    const allowed = matchedRule?.contentTypes;
    if (Array.isArray(allowed) && allowed.length > 0) {
      const ok = allowed.some((ct) => contentType.toLowerCase().startsWith(ct));
      if (!ok) return false;
    } else {
      if (!contentType.includes('text/html')) return false;
    }
    if (response.headers.get('set-cookie')) return false;
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl?.includes('no-store') || cacheControl?.includes('private'))
      return false;
    return true;
  }

  protected getDeploymentMode(headers: Headers): DeploymentMode {
    const mode = headers.get('swell-deployment-mode');
    // Editor mode is never cacheable, so we treat it as live for defaults
    return mode === 'preview' ? 'preview' : 'live';
  }

  protected getTTLForRequest(request: Request): number {
    return this.resolvePathRule(request).effectiveTTL;
  }

  protected getSWRForRequest(request: Request): number {
    return this.resolvePathRule(request).effectiveSWR;
  }

  protected getEntryAge(entry: CachedEntry): number {
    const t = Date.parse(entry.cacheTimeISO);
    if (Number.isNaN(t)) return Infinity;
    const age = (Date.now() - t) / 1000;
    return age < 0 ? 0 : age;
  }

  protected normalizeHeaders(headers: Headers): Record<string, string> {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }

  protected resolvePathRule(request: Request): {
    rule?: PathRule;
    mode: 'live' | 'preview';
    effectiveTTL: number;
    effectiveSWR: number;
    skip: boolean;
  } {
    const url = new URL(request.url);
    const mode = this.getDeploymentMode(request.headers);
    const defaults =
      this.cacheRules.defaults?.[mode] ?? DEFAULT_CACHE_RULES.defaults?.[mode];

    const rule = this.cacheRules.pathRules?.find((r) =>
      r.regex.test(url.pathname),
    );

    const effectiveTTL =
      (rule?.ttl !== undefined ? rule.ttl : defaults?.ttl) ?? defaults.ttl;
    const effectiveSWR =
      (rule?.swr !== undefined ? rule.swr : defaults?.swr) ?? defaults.swr;

    return {
      rule,
      mode,
      effectiveTTL,
      effectiveSWR,
      skip: Boolean(rule?.skip),
    };
  }

  protected normalizeSearchParams(searchParams: URLSearchParams): string {
    const relevantParams: string[] = [];

    searchParams.forEach((value, key) => {
      switch (key) {
        case 'utm_source':
        case 'utm_medium':
        case 'utm_campaign':
        case 'utm_content':
        case 'utm_term':
        case 'fbclid':
        case 'gclid':
        case 'gbraid':
        case 'wbraid':
        case 'ref':
        case 'source':
        case 'mc_cid':
        case 'mc_eid':
          // Ignore params
          break;

        default: {
          relevantParams.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
          );

          break;
        }
      }
    });

    return relevantParams.sort().join('&');
  }
}
