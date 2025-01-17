import type { CFWorkerKV } from 'types/swell';

import { md5 } from '../utils';

/**
 * CloudFlare Workers KV adapter for Keyv.
 * Includes namespacing to prevent conflicts within shared storage.
 */
export class CFWorkerKVKeyvAdapter {
  private namespace: string;
  private store: CFWorkerKV;

  constructor(namespace: string, store: CFWorkerKV) {
    this.namespace = namespace;
    this.store = store;
  }

  async has(key: string) : Promise<boolean> {
    return this.get(key) !== undefined;
  }

  async get(key: string) : Promise<any> {
    return this.store.get(this.cacheKey(key));
  }

  async set(key: string, value: any) : Promise<any> {
    return this.store.put(this.cacheKey(key), value);
  }

  async delete(key: string) : Promise<void> {
    await this.store.delete(this.cacheKey(key));
  }

  async clear() : Promise<void> {
    let cursor = '';
    let complete = false;

    while (!complete) {
      const response = await this.store.list({
        prefix: `${this.namespace}:`,
        cursor: cursor || undefined,
      });

      cursor = response.cursor ?? '';
      complete = response.list_complete;

      if (response.keys.length > 0) {
        await Promise.all(
          response.keys.map((key) => {
            return this.store.delete(key.name);
          }),
        );
      }
    }
  }

  /**
   * Generates a namespaced cache key.
   */
  private cacheKey(key: string) : string {
    let cacheKey = `${this.namespace}:${key}`;
    // TODO: calculate the number of bytes
    // 512 bytes, maximum key for KV storage
    if (cacheKey.length > 512) {
      // TODO: slice the first 480 bytes instead of the length of the code units
      cacheKey = `${cacheKey.slice(0, 480)}${md5(cacheKey)}`;
    }

    return cacheKey;
  }
}
