import { type CreateCacheOptions } from 'cache-manager';
import { Keyv } from 'keyv';

import { Cache } from './cache';

export class ResourceCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      stores: buildStores(),
      ttl: 1000 * 5, // 5s,
    })
  }
}

function buildStores() : Keyv[] {
  return [
    new Keyv({
      // Disabling serialization allows for pure memo-ization of class instances
      // at the tradeoff of no support for compression.
      serialize: undefined,
      deserialize: undefined,
    }),
  ];
}
