import { createCache, type CreateCacheOptions } from 'cache-manager';
import { Keyv } from 'keyv';

const DEFAULT_OPTIONS: CreateCacheOptions = Object.freeze({
  ttl: 1000 * 60 * 60 * 24, // 1 day
});

export class Cache {
  private client: ReturnType<typeof createCache>;

  constructor(options?: CreateCacheOptions) {
    options = options || {};

    // default cache store is memory-store
    options.stores = options.stores || [ new Keyv() ];

    this.client = createCache({
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  async fetch<T>(key: string, fetchFn: () => T | Promise<T>): Promise<T> {
    return this.client.wrap(key, fetchFn);
  }

  async get<T>(key: string) : Promise<T | null> {
    return this.client.get(key);
  }

  async set<T>(key: string, value: T, ttl?: number) : Promise<T> {
    return this.client.set(key, value, ttl);
  }

  async flush(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Flushes the entire cache.
   * Warning: If the cache store is shared among many cache clients,
   *          this will flush entries for other clients.
   */
  async flushAll(): Promise<void> {
    await this.client.clear();
  }
}
