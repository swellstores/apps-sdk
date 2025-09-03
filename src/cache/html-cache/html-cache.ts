import { md5 } from '../../utils';
import { logger, createTraceId } from '../../utils/logger';
import type { CacheBackend, CachedEntry } from './html-cache-backend';

const CACHE_KEY_ORIGIN = 'https://cache.swell.store';

// TTL and SWR settings in seconds
const TTL_CONFIG = {
  LIVE: {
    DEFAULT: 20,
    HOME: 20,
    PRODUCT: 20,
    COLLECTION: 20,
    PAGE: 20,
    BLOG: 20,
    SWR: 60 * 60 * 24 * 7, // 1 week
  },
  PREVIEW: {
    DEFAULT: 10,
    HOME: 10,
    PRODUCT: 10,
    COLLECTION: 10,
    PAGE: 10,
    BLOG: 10,
    SWR: 60 * 60 * 24 * 7, // 1 week
  },
} as const;

type DeploymentMode = 'live' | 'preview' | 'editor';

export interface CacheResult {
  found: boolean;
  stale?: boolean;
  response?: Response;
  cacheable?: boolean;
  age?: number;
  notModified?: boolean;
  conditional304?: Response;
}

/**
 * Contains all the storage-agnostic HTML caching logic.
 * It determines what to cache, for how long, how to build cache keys,
 * and how to construct client responses, while delegating the actual
 * read/write operations to a pluggable backend.
 */
export class HtmlCache {
  protected epoch: string;
  protected backend: CacheBackend;

  constructor(epoch: string, backend: CacheBackend) {
    this.epoch = epoch;
    this.backend = backend;
  }

  async get(request: Request): Promise<CacheResult | null> {
    const trace = createTraceId();

    if (request.method !== 'GET') {
      logger.debug('[SDK Html-cache] non-cacheable method', { trace });
      return { found: false, cacheable: false };
    }

    if (!this.isCacheable(request)) {
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

    if (request.method !== 'GET' || !response.ok) {
      logger.debug('[SDK Html-cache] put skipped, invalid method or response', {
        trace,
      });
      return;
    }

    if (!this.isCacheable(request) || !this.isResponseCacheable(response)) {
      logger.debug('[SDK Html-cache] put skipped, non-cacheable', { trace });
      return;
    }

    try {
      const cacheKey = this.buildCacheKey(request);
      const ttl = this.getTTLForRequest(request);
      const swr = this.getSWRForRequest(request);
      // Don't clone here - the response passed in is already dedicated for caching
      const body = await response.text();
      const cacheTimeISO = new Date().toISOString();

      function lowercaseHeaders(headers: Headers): Record<string, string> {
        const out: Record<string, string> = {};
        headers.forEach((value, key) => {
          out[key.toLowerCase()] = value;
        });
        return out;
      }

      const headers = lowercaseHeaders(response.headers);

      const entry: CachedEntry = {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        cacheTimeISO,
        ttl,
        swr,
        etag: this.quoteETag(headers['etag'] || md5(body)),
        lastModifiedUTC:
          headers['last-modified'] || new Date(cacheTimeISO).toUTCString(),
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

  public isReadCacheCandidate(request: Request): boolean {
    const m = request.method.toUpperCase();
    return (m === 'GET' || m === 'HEAD') && this.isCacheable(request);
  }

  public isWriteCacheCandidate(request: Request, response: Response): boolean {
    if (request.method.toUpperCase() !== 'GET') return false;
    if (!this.isCacheable(request)) return false;
    return this.isResponseCacheable(response);
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

    /*headers.set(
      'Cache-Control',
      `public, max-age=${entry.ttl}, stale-while-revalidate=${entry.swr}`,
    );*/ // otherwise browser may instantly show stale content while cart has changed

    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
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
        if (isNaN(ifModDate.getTime()) || isNaN(lastModDate.getTime())) {
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
    const HOP_BY_HOP = [
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
    ];
    for (const h of HOP_BY_HOP) headers.delete(h);

    headers.delete('content-encoding');
    // Also strip any legacy internal metadata keys
    headers.delete('x-original-ttl');
    headers.delete('x-original-swr');
    headers.delete('x-cache-time');
  }

  protected generateVersionHash(headers: Headers): string {
    const swellData = this.extractSwellData(headers);
    const acceptLang = headers.get('accept-language') || '';
    const accept = headers.get('accept') || '';

    const versionFactors = {
      store: headers.get('swell-storefront-id') || '',
      auth: headers.get('swell-access-token') || '',
      theme: headers.get('swell-theme-version-hash') || '',
      modified: headers.get('swell-cache-modified') || '',
      currency: (swellData['swell-currency'] as string) || 'USD',
      locale:
        headers.get('x-locale') ||
        acceptLang.split(',')[0].trim().toLowerCase() ||
        'default',
      context: headers.get('swell-storefront-context'),
      accept,
      epoch: this.epoch,
    };
    return md5(JSON.stringify(versionFactors));
  }

  protected extractSwellData(headers: Headers): Record<string, unknown> {
    const cookie = headers.get('cookie');
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

  protected isCacheable(request: Request): boolean {
    const url = new URL(request.url);
    if (request.headers.get('swell-deployment-mode') === 'editor') return false;
    const skipPaths = ['/checkout'];
    if (skipPaths.some((path) => url.pathname.startsWith(path))) return false;
    if (request.headers.get('cache-control')?.includes('no-cache'))
      return false;
    return true;
  }

  protected isResponseCacheable(response: Response): boolean {
    if (!response.headers.get('content-type')?.includes('text/html'))
      return false;
    if (response.headers.get('set-cookie')) return false;
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl?.includes('no-store') || cacheControl?.includes('private'))
      return false;
    return true;
  }

  protected getDeploymentMode(headers: Headers): DeploymentMode {
    const mode = headers.get('swell-deployment-mode');
    return mode === 'preview' || mode === 'editor' ? mode : 'live';
  }

  protected getTTLForRequest(request: Request): number {
    const url = new URL(request.url);
    const mode = this.getDeploymentMode(request.headers);
    if (mode === 'editor') return 0;
    const config = mode === 'preview' ? TTL_CONFIG.PREVIEW : TTL_CONFIG.LIVE;
    if (url.pathname === '/') return config.HOME;
    if (url.pathname.startsWith('/products/')) return config.PRODUCT;
    if (url.pathname.startsWith('/categories/')) return config.COLLECTION;
    if (url.pathname.startsWith('/pages/')) return config.PAGE;
    if (url.pathname.startsWith('/blogs/')) return config.BLOG;
    return config.DEFAULT;
  }

  protected getSWRForRequest(request: Request): number {
    const mode = this.getDeploymentMode(request.headers);
    if (mode === 'editor') return 0;
    return mode === 'preview' ? TTL_CONFIG.PREVIEW.SWR : TTL_CONFIG.LIVE.SWR;
  }

  protected getEntryAge(entry: CachedEntry): number {
    const t = Date.parse(entry.cacheTimeISO);
    if (Number.isNaN(t)) return Infinity;
    const age = (Date.now() - t) / 1000;
    return age < 0 ? 0 : age;
  }

  protected normalizeSearchParams(searchParams: URLSearchParams): string {
    const ignoredParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'fbclid',
      'gclid',
      'gbraid',
      'wbraid',
      'ref',
      'source',
      'mc_cid',
      'mc_eid',
    ];
    const relevantParams: string[] = [];
    searchParams.forEach((value, key) => {
      if (!ignoredParams.includes(key)) {
        relevantParams.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        );
      }
    });
    return relevantParams.sort().join('&');
  }
}
