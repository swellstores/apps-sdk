import { Keyv } from 'keyv';

import type { CFWorkerKV } from 'types/swell';

import { Cache } from './cache';
import { CFWorkerKVKeyvAdapter } from './cf-worker-kv-keyv-adapter';

const NAMESPACE = 'THEME';
const TTL = 90 * 24 * 60 * 60 * 1000; // 90 days


/**
 * Theme cache is a 2-layer cache (memory, KV*)
 * The KV layer supports namespacing and compression.
 */
export class ThemeCache extends Cache {
  constructor(store?: CFWorkerKV) {
    super({
      stores: buildStores(store),
      ttl: TTL,
    })
  }
}

function buildStores(store?: CFWorkerKV) {
  const stores = [ new Keyv() ];

  console.log(`Initializing KV store: ${store ? 'enabled' : 'disabled'}`);

  if (store) {
    stores.push(new Keyv({
      namespace: NAMESPACE,
      store: new CFWorkerKVKeyvAdapter(store),
    }));
  }

  return stores;
}
