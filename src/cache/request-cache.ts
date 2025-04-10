import { type CreateCacheOptions } from 'cache-manager';

import { Cache } from './cache';

const KV_TTL = 24 * 60 * 60 * 1000; // 1 day
const MEMORY_TTL = 30 * 1000; // 30s

export class RequestCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      ttl: options?.kvStore ? KV_TTL : MEMORY_TTL,
      ...options,
    });
  }
}
