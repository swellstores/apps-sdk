import { md5 } from '../utils';
import { logger, createTraceId } from '../utils/logger';

const CACHE_NAME = 'swell-html-v0';
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
    SWR: 180,
  },
  PREVIEW: {
    DEFAULT: 20,
    HOME: 20,
    PRODUCT: 20,
    COLLECTION: 20,
    PAGE: 20,
    BLOG: 20,
    SWR: 180,
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

export class WorkerHtmlCache {
  private epoch: string;

  constructor(epoch: string) {
    this.epoch = epoch;
  }

  async get(request: Request): Promise<CacheResult | null> {
    const trace = createTraceId();

    if (request.method !== 'GET') {
      logger.debug('[SDK Html-cache] non-cacheable', { trace });
      return { found: false, cacheable: false };
    }

    if (!this.isCacheable(request)) {
      logger.debug('[SDK Html-cache] non-cacheable', { trace });
      return { found: false, cacheable: false };
    }

    try {
      const cache = await caches.open(CACHE_NAME + this.epoch);
      const cacheKey = this.buildCacheKey(request);
      const cached = await cache.match(cacheKey);

      if (!cached) {
        logger.debug('[SDK Html-cache] cacheable, MISS', { trace });
        return { found: false, cacheable: true };
      }

      const age = this.getResponseAge(cached);

      // Get TTL and SWR from stored metadata or recalculate
      const ttl =
        parseInt(cached.headers.get('X-Original-TTL') || '') ||
        this.getTTLForRequest(request);
      const swr =
        parseInt(cached.headers.get('X-Original-SWR') || '') ||
        this.getSWRForRequest(request);

      const isStale = age >= ttl;
      const isExpired = age >= ttl + swr;

      if (!isExpired) {
        logger.debug('[SDK Html-cache] cacheable, HIT', {
          stale: isStale,
          age,
          trace,
        });

        // Build corrected client response with proper headers
        const clientResponse = this.buildClientResponse(
          cached,
          ttl,
          swr,
          isStale,
          age,
        );

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
    } catch (_) {
      logger.warn('[SDK Html-cache] no get support', { trace });
      return null;
    }
  }

  // 304 support
  async getWithConditionals(request: Request): Promise<CacheResult | null> {
    const result = await this.get(request);

    if (!result?.found || result.stale) {
      return result;
    }

    // Check conditional headers for 304 response
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

  private checkNotModified(
    ifModifiedSince: string | null,
    ifNoneMatch: string | null,
    lastModified: string | null,
    etag: string | null,
  ): boolean {
    if (ifNoneMatch && etag) {
      return ifNoneMatch === etag;
    }

    if (ifModifiedSince && lastModified) {
      const ifModDate = new Date(ifModifiedSince);
      const lastModDate = new Date(lastModified);
      return (
        !isNaN(ifModDate.getTime()) &&
        !isNaN(lastModDate.getTime()) &&
        ifModDate >= lastModDate
      );
    }

    return false;
  }

  createRevalidationRequest(request: Request): Request {
    const headers = new Headers(request.headers);

    // Signal this is a revalidation to prevent loops
    headers.set('X-Cache-Bypass', 'revalidation');

    // Remove conditional headers to ensure fresh fetch
    headers.delete('If-None-Match');
    headers.delete('If-Modified-Since');
    headers.delete('Cache-Control');
    headers.delete('Pragma');

    return new Request(request.url, {
      method: 'GET',
      headers,
    });
  }

  async put(request: Request, response: Response): Promise<void> {
    const trace = createTraceId();

    if (request.method !== 'GET' || !response.ok) {
      logger.debug('[SDK Html-cache] put skipped', { trace });
      return;
    }

    if (!this.isCacheable(request) || !this.isResponseCacheable(response)) {
      logger.debug('[SDK Html-cache] put skipped, non-cacheable', {
        trace,
      });
      return;
    }

    try {
      const cache = await caches.open(CACHE_NAME + this.epoch);
      const cacheKey = this.buildCacheKey(request);

      await cache.delete(cacheKey);

      const ttl = this.getTTLForRequest(request);
      const swr = this.getSWRForRequest(request);

      const headers = new Headers(response.headers);

      // Only override Cache-Control if not already set or if it's permissive
      const existingCacheControl = response.headers.get('Cache-Control');
      if (!existingCacheControl || existingCacheControl === 'public') {
        // Use extended max-age to keep entry alive for full SWR period
        const internalMaxAge = ttl + swr;
        headers.set('Cache-Control', `public, max-age=${internalMaxAge}`);
      }

      // Store metadata for correct client response construction
      const cacheTime = new Date().toISOString();
      headers.set('X-Cache-Time', cacheTime);
      headers.set('X-Original-TTL', ttl.toString());
      headers.set('X-Original-SWR', swr.toString());

      // Set stable Last-Modified if not already present
      // This enables efficient 304 responses from Edge CDN
      if (!headers.get('Last-Modified')) {
        headers.set('Last-Modified', new Date(cacheTime).toUTCString());
      }

      const cacheableResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });

      await cache.put(cacheKey, cacheableResponse);
      logger.debug('[SDK Html-cache] put done', { trace });
    } catch (_) {
      logger.warn('[SDK Html-cache] no put support', { trace });
    }
  }

  private buildClientResponse(
    cachedResponse: Response,
    ttl: number,
    swr: number,
    isStale: boolean,
    age: number,
  ): Response {
    const headers = new Headers(cachedResponse.headers);

    // Set correct client-facing Cache-Control for browsers
    headers.set(
      'Cache-Control',
      `public, max-age=${ttl}, stale-while-revalidate=${swr}`,
    );

    // Explicitly control Cloudflare's edge cache behavior
    // This overrides default Origin Cache Control behavior for precise control
    headers.set(
      'Cloudflare-CDN-Cache-Control',
      `public, s-maxage=${ttl}, stale-while-revalidate=${swr}, stale-if-error=60`,
    );

    // Ensure stable Last-Modified for efficient conditional requests
    // Use the original cache time as Last-Modified for consistency
    const cacheTime = headers.get('X-Cache-Time');
    if (cacheTime) {
      const lastModified = new Date(cacheTime).toUTCString();
      headers.set('Last-Modified', lastModified);
    }

    // Add cache status headers
    headers.set('X-Cache-Status', isStale ? 'STALE' : 'HIT');
    headers.set('X-Cache-Age', Math.floor(age).toString());

    // Remove internal metadata headers
    headers.delete('X-Original-TTL');
    headers.delete('X-Original-SWR');
    headers.delete('X-Cache-Time'); // Don't expose internal cache time

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  private buildCacheKey(request: Request): Request {
    const url = new URL(request.url);

    const versionHash = this.generateVersionHash(request.headers);

    const normalizedQuery = this.normalizeSearchParams(url.searchParams);

    const cacheKeyPath = `${versionHash}${url.pathname}`;
    const keyUrl = new URL(`${CACHE_KEY_ORIGIN}${cacheKeyPath}`);

    if (normalizedQuery) {
      keyUrl.search = `?${normalizedQuery}`;
    }

    const sanitizedHeaders = this.sanitizeHeaders(request.headers);
    return new Request(keyUrl.toString(), {
      method: 'GET',
      headers: sanitizedHeaders,
    });
  }

  private sanitizeHeaders(originalHeaders: Headers): Headers {
    // Minimal headers needed for cache behavior
    // Most content variation is already handled by version hash
    const CACHE_RELEVANT_HEADERS = [
      // Content negotiation (affects response format)
      'accept',
      'accept-language',
    ];

    const sanitized = new Headers();

    CACHE_RELEVANT_HEADERS.forEach((header) => {
      const value = originalHeaders.get(header);
      if (value) {
        sanitized.set(header, value);
      }
    });

    return sanitized;
  }

  private generateVersionHash(headers: Headers): string {
    const swellData = this.extractSwellData(headers);

    const versionFactors = {
      store: headers.get('swell-storefront-id') || '',
      auth: headers.get('swell-access-token') || '',

      theme: headers.get('swell-theme-version-hash') || '',

      modified: headers.get('swell-cache-modified') || '',

      currency: (swellData['swell-currency'] as string) || 'USD',
      locale:
        headers.get('x-locale') ||
        headers.get('accept-language')?.split(',')[0] ||
        'default',

      context: headers.get('swell-storefront-context'),

      epoch: this.epoch,
    };

    return md5(JSON.stringify(versionFactors));
  }

  private extractSwellData(headers: Headers): Record<string, unknown> {
    const cookie = headers.get('cookie');
    if (!cookie) return {};

    const swellDataMatch = cookie.match(/swell-data=([^;]+)/);
    if (!swellDataMatch) return {};

    try {
      const parsed = JSON.parse(decodeURIComponent(swellDataMatch[1]));
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  private isCacheable(request: Request): boolean {
    const url = new URL(request.url);
    const headers = request.headers;

    if (headers.get('swell-deployment-mode') === 'editor') {
      return false;
    }

    const skipPaths = ['/checkout']; // just for an example

    if (skipPaths.some((path) => url.pathname.startsWith(path))) {
      return false;
    }

    if (headers.get('cache-control')?.includes('no-cache')) {
      return false;
    }

    return true;
  }

  private isResponseCacheable(response: Response): boolean {
    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('text/html')) {
      return false;
    }

    // Never cache responses that set cookies as they likely contain user-specific data
    if (response.headers.get('set-cookie')) {
      return false;
    }

    const cacheControl = response.headers.get('cache-control');
    if (
      cacheControl?.includes('no-store') ||
      cacheControl?.includes('private')
    ) {
      return false;
    }

    return true;
  }

  private getDeploymentMode(headers: Headers): DeploymentMode {
    const mode = headers.get('swell-deployment-mode');
    if (mode === 'preview' || mode === 'editor') {
      return mode;
    }
    return 'live';
  }

  private getTTLForRequest(request: Request): number {
    const url = new URL(request.url);
    const path = url.pathname;
    const mode = this.getDeploymentMode(request.headers);

    // Editor mode should not cache, but if we get here, use minimal TTL
    if (mode === 'editor') {
      return 0;
    }

    const config = mode === 'preview' ? TTL_CONFIG.PREVIEW : TTL_CONFIG.LIVE;

    if (path === '/') {
      return config.HOME;
    }

    if (path.startsWith('/products/')) {
      return config.PRODUCT;
    }

    if (path.startsWith('/categories/')) {
      return config.COLLECTION;
    }

    if (path.startsWith('/pages/')) {
      return config.PAGE;
    }

    if (path.startsWith('/blogs/')) {
      return config.BLOG;
    }

    return config.DEFAULT;
  }

  private getSWRForRequest(request: Request): number {
    const mode = this.getDeploymentMode(request.headers);

    // Editor mode should not use SWR
    if (mode === 'editor') {
      return 0;
    }

    return mode === 'preview' ? TTL_CONFIG.PREVIEW.SWR : TTL_CONFIG.LIVE.SWR;
  }

  private getResponseAge(response: Response): number {
    const cacheTime = response.headers.get('X-Cache-Time');
    if (!cacheTime) {
      return Infinity;
    }

    const cacheDate = new Date(cacheTime);
    if (isNaN(cacheDate.getTime())) {
      return Infinity;
    }

    const age = (Date.now() - cacheDate.getTime()) / 1000;
    return Math.max(0, age);
  }

  private normalizeSearchParams(searchParams: URLSearchParams): string {
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
