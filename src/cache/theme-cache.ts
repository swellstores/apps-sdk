import { type CreateCacheOptions } from 'cache-manager';

import { Cache } from './cache';

const TTL = 90 * 24 * 60 * 60 * 1000; // 90 days

export class ThemeCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      ttl: TTL,
      ...options,
    });
  }
}
