import { Cache, type CreateCacheOptions } from './cache';

const TTL = 90 * 24 * 60 * 60 * 1000; // 90 days

export class ThemeCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      ttl: TTL,
      ...options,
    });
  }
}
