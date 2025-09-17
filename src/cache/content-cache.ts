import { Cache, type CreateCacheOptions } from './cache';

const DEFAULT_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days

export interface ContentCacheOptions extends CreateCacheOptions {
  defaultTtl?: number;
}

/**
 * Simple content cache exposing only get/set operations.
 * Designed for caching versioned, immutable content like rendered assets.
 */
export class ContentCache {
  private cache: Cache;
  private defaultTtl: number;

  constructor(options?: ContentCacheOptions) {
    const { defaultTtl, ...cacheOptions } = options || {};
    this.defaultTtl = defaultTtl ?? DEFAULT_TTL;
    this.cache = new Cache({
      ttl: this.defaultTtl,
      ...cacheOptions,
    });
  }

  /**
   * Get content from cache
   */
  async get<T = any>(key: string): Promise<T | undefined> {
    return this.cache.get<T>(key);
  }

  /**
   * Set content in cache
   */
  async set<T = any>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cache.set(key, value, ttl ?? this.defaultTtl);
  }
}
