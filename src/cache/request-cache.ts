import { Keyv } from 'keyv';

import { Cache } from './cache';

const TTL = 1000 * 5; // 5s,

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
