import { Keyv } from 'keyv';
import {
  createCache,
  type CreateCacheOptions as OriginalCreateCacheOptions,
  type Cache as CacheManager,
} from 'cache-manager';

import { CFWorkerKVKeyvAdapter } from './cf-worker-kv-keyv-adapter';
import { resolveAsyncResources } from '../utils';

import type { CFWorkerKV, CFWorkerContext } from 'types/cloudflare';

export type CreateCacheOptions = OriginalCreateCacheOptions & {
  kvStore?: CFWorkerKV;
  workerCtx?: CFWorkerContext;
};

const CF_KV_NAMESPACE = 'THEME';

const DEFAULT_TTL = 5 * 1000; // 5s
const DEFAULT_SWR_TTL = 1000 * 60 * 60 * 24 * 7; // 1 week

const DEFAULT_OPTIONS: CreateCacheOptions = Object.freeze({
  ttl: DEFAULT_TTL,
});

/**
 * Value used to indicate `null` to differentiate between actual `null` values and unset cache keys
 *
 * Necessary because cache manager always returns `null` when a value has not been set yet
 */
const NULL_VALUE = '__NULL__';

const SWR_PROMISE_MAP = new Map<string, Promise<unknown>>();
const FETCH_PROMISE_MAP = new Map<string, Promise<unknown>>();

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

  /**
   * Always fetches fresh data and updates cache
   * Deduplicates concurrent requests with the same key
   *
   * @param key Cache key
   * @param fetchFn Function to fetch fresh data
   * @param ttl Time to live in milliseconds (default: DEFAULT_SWR_TTL)
   * @param isCacheable Whether to store result in cache (default: true)
   */
  async fetch<T>(
    key: string,
    fetchFn: () => T | Promise<T>,
    ttl: number = DEFAULT_SWR_TTL,
    isCacheable = true,
  ): Promise<T> {
    // Check for concurrent request deduplication
    let promise = FETCH_PROMISE_MAP.get(key) as Promise<T> | undefined;

    if (!promise) {
      promise = Promise.resolve()
        .then(fetchFn)
        .then(resolveAsyncResources)
        .then(async (value) => {
          // Store null values as NULL_VALUE to differentiate between unset keys and actual null values
          const isNull = value === null || value === undefined;
          if (isCacheable) {
            await this.client.set(key, isNull ? NULL_VALUE : value, ttl);
          }
          return value as T;
        })
        .finally(() => {
          FETCH_PROMISE_MAP.delete(key);
        });

      FETCH_PROMISE_MAP.set(key, promise);
    }

    return await promise;
  }

  /**
   * Fetch cache using SWR (stale-while-revalidate)
   *
   * This will always return the cached value immediately if exists
   */
  async fetchSWR<T>(
    key: string,
    fetchFn: () => T | Promise<T>,
    ttl: number = DEFAULT_SWR_TTL,
    isCacheble = true,
  ): Promise<T> {
    const cacheValue = isCacheble ? await this.client.get<T>(key) : undefined;

    // Do not create duplicate requests
    let promise = SWR_PROMISE_MAP.get(key);

    if (promise === undefined) {
      // Update cache asynchronously
      promise = Promise.resolve()
        .then(fetchFn)
        .then(resolveAsyncResources)
        .then(async (value) => {
          // Store null values as NULL_VALUE to differentiate between unset keys and actual null values
          const isNull = value === null || value === undefined;
          if (isCacheble) {
            await this.client.set(key, isNull ? NULL_VALUE : value, ttl);
          }
          return value as T;
        })
        .finally(() => {
          SWR_PROMISE_MAP.delete(key);
        });

      SWR_PROMISE_MAP.set(key, promise);
    }

    // Make the worker wait until the promise is resolved if possible
    if (typeof this.workerCtx?.waitUntil === 'function') {
      this.workerCtx.waitUntil(promise);
    }

    if (cacheValue !== undefined) {
      return cacheValue === NULL_VALUE ? (null as T) : (cacheValue as T);
    }

    const result = await (promise as Promise<T>);

    return result;
  }

  async get<T>(key: string): Promise<T | undefined> {
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
   *
   * __WARNING__: If the cache store is shared among many cache clients,
   *              this will flush entries for other clients.
   */
  async flushAll(): Promise<void> {
    await this.client.clear();
  }
}

function buildStores(kvStore?: CFWorkerKV): Keyv[] {
  const stores: Keyv[] = [];

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
