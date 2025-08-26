// ABOUTME: In-memory stub for Cloudflare Cache API for local development
// Provides the same interface as the real Cache API but stores data in memory

/**
 * In-memory cache storage for local development
 */
class InMemoryCacheStorage implements Cache {
  private storage: Map<string, Response> = new Map();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const key = this.getKey(request);
    const cached = this.storage.get(key);

    if (!cached) {
      return undefined;
    }

    // Check if expired based on Cache-Control header
    const cacheControl = cached.headers.get('Cache-Control');
    const cacheTime = cached.headers.get('X-Cache-Time');

    if (cacheControl && cacheTime) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        const maxAge = parseInt(maxAgeMatch[1], 10) * 1000; // Convert to ms
        const age = Date.now() - new Date(cacheTime).getTime();

        if (age > maxAge * 2) {
          // Too old, remove from cache
          this.storage.delete(key);
          return undefined;
        }
      }
    }

    // Clone the response so body can be read multiple times
    return cached.clone();
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = this.getKey(request);
    // Clone the response before storing
    this.storage.set(key, response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const key = this.getKey(request);
    return this.storage.delete(key);
  }

  // Not implemented in stub
  async matchAll(): Promise<Response[]> {
    return [];
  }

  async add(): Promise<void> {
    // Not implemented in stub
  }

  async addAll(): Promise<void> {
    // Not implemented in stub
  }

  async keys(): Promise<Request[]> {
    return [];
  }

  private getKey(request: RequestInfo | URL): string {
    if (request instanceof Request) {
      return request.url;
    } else if (request instanceof URL) {
      return request.toString();
    } else {
      return String(request);
    }
  }
}

/**
 * CacheStorage stub for local development
 */
class CacheStorageStub implements CacheStorage {
  private caches: Map<string, InMemoryCacheStorage> = new Map();

  async open(cacheName: string): Promise<Cache> {
    if (!this.caches.has(cacheName)) {
      this.caches.set(cacheName, new InMemoryCacheStorage());
    }
    return this.caches.get(cacheName)!;
  }

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    // Check all caches
    for (const cache of this.caches.values()) {
      const response = await cache.match(request);
      if (response) {
        return response;
      }
    }
    return undefined;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }
}

// Initialize the stub immediately if caches is not defined
// COMMENT OUT THE FOLLOWING LINE BEFORE DEPLOYMENT
if (typeof caches === 'undefined' && typeof globalThis !== 'undefined') {
  globalThis.caches = new CacheStorageStub();
  console.log(
    '[Cache API Stub] Initialized in-memory cache for local development',
  );
}
