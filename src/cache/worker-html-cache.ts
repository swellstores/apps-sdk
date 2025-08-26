import { md5 } from '../utils';
import { logger, createTraceId } from '../utils/logger';

const CACHE_NAME = 'swell-html-v1';
const CACHE_KEY_ORIGIN = 'https://cache.swell.store';

const TTL_CONFIG = {
  DEFAULT: 300, // 5 minutes
  DEFAULT_SWR: 3600, // 1 hour stale-while-revalidate
  HOME: 300, // 5 minutes
  PRODUCT: 600, // 10 minutes
  COLLECTION: 900, // 15 minutes
  PAGE: 3600, // 1 hour
  BLOG: 1800, // 30 minutes
} as const;

export interface CacheResult {
  found: boolean;
  stale?: boolean;
  response?: Response;
  cacheable?: boolean;
  age?: number;
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
        TTL_CONFIG.DEFAULT_SWR;

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

      const ttl = this.getTTLForRequest(request);
      const swr = TTL_CONFIG.DEFAULT_SWR;

      const headers = new Headers(response.headers);

      // Only override Cache-Control if not already set or if it's permissive
      const existingCacheControl = response.headers.get('Cache-Control');
      if (!existingCacheControl || existingCacheControl === 'public') {
        // Use extended max-age to keep entry alive for full SWR period
        const internalMaxAge = ttl + swr;
        headers.set('Cache-Control', `public, max-age=${internalMaxAge}`);
      }

      // Store metadata for correct client response construction
      headers.set('X-Cache-Time', new Date().toISOString());
      headers.set('X-Original-TTL', ttl.toString());
      headers.set('X-Original-SWR', swr.toString());

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

  /**
   * Build client response with correct headers
   */
  private buildClientResponse(
    cachedResponse: Response,
    ttl: number,
    swr: number,
    isStale: boolean,
    age: number,
  ): Response {
    // Create new response with fresh headers
    const headers = new Headers(cachedResponse.headers);

    // Set correct client-facing Cache-Control
    headers.set(
      'Cache-Control',
      `public, max-age=${ttl}, stale-while-revalidate=${swr}`,
    );

    // Add cache status headers
    headers.set('X-Cache-Status', isStale ? 'STALE' : 'HIT');
    headers.set('X-Cache-Age', Math.floor(age).toString());

    // Remove internal metadata headers
    headers.delete('X-Original-TTL');
    headers.delete('X-Original-SWR');

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  }

  /**
   * Build cache key from request using two-level structure
   */
  private buildCacheKey(request: Request): Request {
    const url = new URL(request.url);

    const versionHash = this.generateVersionHash(request.headers);

    const normalizedQuery = this.normalizeSearchParams(url.searchParams);

    const cacheKeyPath = `${versionHash}${url.pathname}`;
    const keyUrl = new URL(`${CACHE_KEY_ORIGIN}${cacheKeyPath}`);

    if (normalizedQuery) {
      keyUrl.search = `?${normalizedQuery}`;
    }

    // Create request with SANITIZED headers for cache matching
    // This prevents unique per-request headers from breaking cache lookups
    const sanitizedHeaders = this.sanitizeHeaders(request.headers);
    return new Request(keyUrl.toString(), {
      method: 'GET',
      headers: sanitizedHeaders,
    });
  }

  /**
   * Sanitize headers for cache operations - minimal whitelist approach
   */
  private sanitizeHeaders(originalHeaders: Headers): Headers {
    // Minimal headers needed for cache behavior
    // Most content variation is already handled by version hash
    const CACHE_RELEVANT_HEADERS = [
      // Content negotiation (affects response format)
      'accept',
      'accept-encoding',
      'accept-language',

      // Cache control directives from client/proxy
      'cache-control',
      'pragma', // Legacy cache control

      // Conditional request headers (for 304 responses)
      'if-none-match',
      'if-modified-since',
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

  /**
   * Generate version hash from headers and cookies
   */
  private generateVersionHash(headers: Headers): string {
    const swellData = this.extractSwellData(headers);

    const versionFactors = {
      store: headers.get('swell-storefront-id') || '',
      auth: headers.get('swell-access-token') || '',

      theme: headers.get('swell-theme-version-hash') || '',

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

  /**
   * Extract swell-data from cookies
   */
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

    const cacheControl = response.headers.get('cache-control');
    if (
      cacheControl?.includes('no-store') ||
      cacheControl?.includes('private')
    ) {
      return false;
    }

    return true;
  }

  private getTTLForRequest(request: Request): number {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/') {
      return TTL_CONFIG.HOME;
    }

    if (path.startsWith('/products/')) {
      return TTL_CONFIG.PRODUCT;
    }

    if (path.startsWith('/categories/')) {
      return TTL_CONFIG.COLLECTION;
    }

    if (path.startsWith('/pages/')) {
      return TTL_CONFIG.PAGE;
    }

    if (path.startsWith('/blogs/')) {
      return TTL_CONFIG.BLOG;
    }

    return TTL_CONFIG.DEFAULT;
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

  private getMaxAge(response: Response): number {
    const cacheControl = response.headers.get('Cache-Control');
    if (!cacheControl) {
      return TTL_CONFIG.DEFAULT;
    }

    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      return parseInt(maxAgeMatch[1], 10);
    }

    return TTL_CONFIG.DEFAULT;
  }

  private getStaleWindow(response: Response): number {
    const cacheControl = response.headers.get('Cache-Control');
    if (!cacheControl) {
      return TTL_CONFIG.DEFAULT_SWR;
    }

    const swrMatch = cacheControl.match(/stale-while-revalidate=(\d+)/);
    if (swrMatch) {
      return parseInt(swrMatch[1], 10);
    }

    return TTL_CONFIG.DEFAULT_SWR;
  }

  /**
   * Normalize search params for cache key
   */
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
