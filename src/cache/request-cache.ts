import { Keyv } from 'keyv';

import { Cache } from './cache';

const TTL = 30 * 1000; // 30s,

export class RequestCache extends Cache {
  constructor() {
    super({
      stores: buildStores(),
      ttl: TTL, // 5s,
    })
  }
}

function buildStores() : Keyv[] {
  return [ new Keyv() ];
}
