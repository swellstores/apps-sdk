import { Keyv } from 'keyv';
import {
  createCache,
  type CreateCacheOptions as OriginalCreateCacheOptions,
  type Cache as CacheManager,
} from 'cache-manager';

import { CFWorkerKVKeyvAdapter } from './cf-worker-kv-keyv-adapter';
import { resolveAsyncResources } from '../utils';

import type { CFWorkerKV, CFWorkerContext } from 'types/swell';

export type CreateCacheOptions = OriginalCreateCacheOptions & {
  kvStore?: CFWorkerKV;
  workerCtx?: CFWorkerContext;
};

export const CF_KV_NAMESPACE = 'THEME';

const DEFAULT_TTL = 5 * 1000; // 5s
const DEFAULT_SWR_TTL = 1000 * 60 * 60 * 24 * 7; // 1 week

const DEFAULT_OPTIONS: CreateCacheOptions = Object.freeze({
  ttl: DEFAULT_TTL,
});

// Value used to indicate null to differentiate between actual null values and unset cache keys
// Necessary because cache manager always returns null when a value has not been set yet
const NULL_VALUE = '__NULL__';

/**
 * Cache supports memory or KV
 * The KV layer supports namespacing and compression
 */
export class Cache {
  private client: CacheManager;
  private workerCtx?: CFWorkerContext;

  constructor(options?: CreateCacheOptions) {
    options = options || {};

    this.workerCtx = options.workerCtx;

    // default cache store is memory-store
    options.stores = options.stores || buildStores(options.kvStore);

    this.client = createCache({
      ...DEFAULT_OPTIONS,
      ...options,
    });
  }

  async fetch<T>(key: string, fetchFn: () => T | Promise<T>): Promise<T> {
    return this.client.wrap(key, fetchFn);
  }

  // Fetch cache using SWR (stale-while-revalidate)
  // This will always return the cached value immediately if exists
  async fetchSWR<T>(
    key: string,
    fetchFn: () => T | Promise<T>,
    ttl: number = DEFAULT_SWR_TTL,
  ): Promise<T> {
    const cacheValue = await this.client.get(key);

    console.log('Cache.fetchSWR', {
      key,
      ttl,
      cacheValue,
    });

    // Update cache asynchronously
    const promiseValue = Promise.resolve()
      .then(() => fetchFn())
      .then(async (value) => {
        // Store null values as NULL_VALUE to differentiate between unset keys and actual null values
        const isNull = value === null || value === undefined;
        const valueResolved = await resolveAsyncResources(value);
        console.log('Cache.fetchSWR result', {
          key,
          value: Boolean(value),
          valueResolved,
        });
        await this.client.set(key, isNull ? NULL_VALUE : valueResolved, ttl);
        return value;
      });

    // Make the worker wait until the promise is resolved if possible
    if (this.workerCtx?.waitUntil) {
      console.log('Cache.fetchSWR waitUntil', { key })
      this.workerCtx.waitUntil(promiseValue);
    }

    if (cacheValue !== null) {
      return cacheValue === NULL_VALUE ? (null as T) : (cacheValue as T);
    }

    const result = await promiseValue;

    return result as T;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.client.get(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<T> {
    return this.client.set(key, value, ttl);
  }

  async flush(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Flushes the entire cache.
   * WARNING: If the cache store is shared among many cache clients,
   *          this will flush entries for other clients.
   */
  async flushAll(): Promise<void> {
    await this.client.clear();
  }
}

function buildStores(kvStore?: CFWorkerKV) {
  const stores = [];

  if (kvStore) {
    stores.push(
      new Keyv({
        namespace: CF_KV_NAMESPACE,
        store: new CFWorkerKVKeyvAdapter(kvStore),
      }),
    );
  } else {
    // Fall back to memory store
    // This is not suitable for a large number of clients
    // as it could kill the process with memory overload
    stores.push(new Keyv());
  }

  return stores;
}
