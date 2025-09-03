import type { CacheBackend, CachedEntry } from './html-cache-backend';

const CACHE_NAME_PREFIX = 'swell-html-v0';

export class WorkerCacheBackend implements CacheBackend {
  private readonly cacheName: string;

  constructor(epoch: string) {
    this.cacheName = CACHE_NAME_PREFIX + epoch;
  }

  async read(key: string): Promise<CachedEntry | null> {
    const cache = await caches.open(this.cacheName);
    const request = new Request(key);
    const response = await cache.match(request);
    if (!response) return null;

    // Normalize header names to lowercase for consistency with base.
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      headers[name.toLowerCase()] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers,
      body: await response.text(),
      cacheTimeISO:
        response.headers.get('x-cache-time') || new Date(0).toISOString(),
      ttl: parseInt(response.headers.get('x-original-ttl') || '0', 10),
      swr: parseInt(response.headers.get('x-original-swr') || '0', 10),
      etag: response.headers.get('etag') || undefined,
      lastModifiedUTC: response.headers.get('last-modified') || undefined,
    };
  }

  async write(
    key: string,
    entry: CachedEntry,
    _hardExpireSeconds: number,
  ): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const request = new Request(key);

    const headers = new Headers(entry.headers);

    // Ensure conditional metadata is present even if origin didn't send it
    if (entry.lastModifiedUTC && !headers.get('Last-Modified')) {
      headers.set('Last-Modified', entry.lastModifiedUTC);
    }
    if (entry.etag && !headers.get('ETag')) {
      headers.set('ETag', entry.etag);
    }

    // Persist internal metadata for future reads
    headers.set('X-Cache-Time', entry.cacheTimeISO);
    headers.set('X-Original-TTL', String(entry.ttl));
    headers.set('X-Original-SWR', String(entry.swr));

    // Avoid mismatched encodings/length with reconstituted body
    headers.delete('content-encoding');
    headers.delete('content-length');

    // Optional parity with legacy behavior
    const existing = headers.get('Cache-Control');
    if (!existing || existing.trim().toLowerCase() === 'public') {
      headers.set('Cache-Control', `public, max-age=${entry.ttl + entry.swr}`);
    }

    const response = new Response(entry.body, {
      status: entry.status,
      statusText: entry.statusText,
      headers,
    });

    // Optional: delete first for cleanliness (not required)
    await cache.delete(request);
    await cache.put(request, response);
  }

  async delete(key: string): Promise<void> {
    const cache = await caches.open(this.cacheName);
    const request = new Request(key);
    await cache.delete(request);
  }
}
