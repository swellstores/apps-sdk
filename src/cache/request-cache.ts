import { type CreateCacheOptions } from './cache';
import { Cache } from './cache';

export class RequestCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      ...options,
    });
  }
}
