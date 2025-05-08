import { Keyv } from 'keyv';

import { Cache, type CreateCacheOptions } from './cache';

export class ResourceCache extends Cache {
  constructor(options?: CreateCacheOptions) {
    super({
      stores: buildStores(),
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
