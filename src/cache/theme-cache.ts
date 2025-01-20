import { KeyvBrotli } from '@keyv/compress-brotli';
import { Keyv } from 'keyv';
import QuickLRU from 'quick-lru';

import type { CFWorkerKV } from 'types/swell';

import { Cache } from './cache';
import { CFWorkerKVKeyvAdapter } from './cf-worker-kv-keyv-adapter';

const TTL = 1000 * 60; // 1m
const MAX_ENTRIES = 100; // per client


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
  const stores = [
    new Keyv({
      store: new QuickLRU({ maxSize: MAX_ENTRIES }),
    }),
  ];

  console.log(`Initializing KV store${store ? ` - KV: enabled` : ''}`);

  if (store) {
    stores.push(new Keyv({
      store: new CFWorkerKVKeyvAdapter(namespace, store),
      compression: KeyvBrotli
    }));
  }

  return stores;
}
