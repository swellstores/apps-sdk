import { Keyv } from 'keyv';
import QuickLRU from 'quick-lru';

import { Cache } from './cache';

const TTL = 1000 * 5; // 5s,
const MAX_ENTRIES = 1000;

export class RequestCache extends Cache {
  constructor() {
    super({
      stores: buildStores(),
      ttl: TTL, // 5s,
    })
  }
}

function buildStores() : Keyv[] {
  return [
    new Keyv({
      // @ts-ignore
      store: new QuickLRU.default({ maxSize: MAX_ENTRIES }),
    }),
  ];
}
