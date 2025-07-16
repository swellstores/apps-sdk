import { Cache, type CreateCacheOptions } from './cache';

export class RequestCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      ...options,
    });
  }
}
