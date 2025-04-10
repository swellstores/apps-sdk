import { Keyv } from 'keyv';

import { Cache, type CreateCacheOptions } from './cache';

const TTL = 5 * 1000; // 5s

export class ResourceCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      stores: buildStores(),
      ttl: TTL,
      ...options,
    });
  }
}

function buildStores(): Keyv[] {
  return [
    new Keyv({
      // Disabling serialization allows for pure memo-ization of class instances
      // at the tradeoff of no support for compression.
      serialize: undefined,
      deserialize: undefined,
    }),
  ];
}
