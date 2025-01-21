import { Keyv } from 'keyv';

import type { CFWorkerKV } from 'types/swell';

import { Cache } from './cache';
import { CFWorkerKVKeyvAdapter } from './cf-worker-kv-keyv-adapter';

const TTL = 90 * 24 * 60 * 60 * 1000; // 90 days


/**
 * Theme cache is a 2-layer cache (memory, KV*)
 * The KV layer supports namespacing and compression.
 */
export class ThemeCache extends Cache {
  constructor(namespace: string, store?: CFWorkerKV) {
    super({
      stores: buildStores(namespace, store),
      ttl: TTL,
    })
  }
}

function buildStores(namespace: string, store?: CFWorkerKV) {
  const stores = [ new Keyv() ];

  console.log(`Initializing KV store: ${store ? 'enabled' : 'disabled'}`);

  if (store) {
    stores.push(new Keyv({
      namespace: 'theme',
      store: new CFWorkerKVKeyvAdapter(namespace, store),
    }));
  }

  return stores;
}
