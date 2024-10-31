// Cache prefers to use a Cloudflare KV store,
// but will fall back to an in-memory cache if one is not available.
// This class offers a subset interface of Map except with async methods, including:
// get(), set(), delete(), has()
//
// Map is used first, then CFWorkerKV to populate the map afterwards.

import { StorefrontResource } from './api';

import type { CFWorkerKV } from 'types/swell';

export class Cache {
  private map: Map<string, [timer: number | NodeJS.Timeout, value: unknown]> =
    new Map();
  private kvStore?: CFWorkerKV;
  private timeoutDefault: number;

  constructor(kvStore?: CFWorkerKV, timeoutDefault: number = 60000) {
    if (kvStore) {
      this.kvStore = kvStore;
    }

    console.log(
      `Initializing cache - timeout: ${timeoutDefault}${
        kvStore ? ` - KV: enabled` : ''
      }`,
    );

    this.timeoutDefault = timeoutDefault;
  }

  setValues(values: Array<[string, unknown]>): void {
    this.map = new Map(values.map(([key, value]) => [key, [0, value]]));
  }

  getValues() {
    return Array.from(this.map).map(([key, pair]) => [key, pair[1]]);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const pair = this.map.get(key);

    if (pair !== undefined) {
      return pair[1] as T;
    }

    if (this.kvStore) {
      let cacheValue;

      const value = await this.kvStore.get(key);

      // Null means undefined in KV
      if (value === null) {
        cacheValue = undefined;
      } else {
        try {
          cacheValue = JSON.parse(value);

          if (cacheValue === 'KV_NULL') {
            cacheValue = null;
          }

          this.setSync(key, cacheValue, this.timeoutDefault);
        } catch (err: any) {
          console.error('Cache.get JSON.parse error', key, err.message, value);
        }
      }

      return cacheValue;
    }

    return undefined;
  }

  getSync<T>(key: string): T | undefined {
    const pair = this.map.get(key);
    return pair ? (pair[1] as T) : undefined;
  }

  async set(
    key: string,
    value: any,
    timeout: number = this.timeoutDefault,
  ): Promise<void> {
    this.setSync(key, value, timeout);

    if (this.kvStore) {
      let cacheValue = value;

      if (value instanceof Promise) {
        cacheValue = await value;
      }

      if (cacheValue instanceof StorefrontResource) {
        return;
      }

      // Need to indicate to kv that it's not undefined
      if (cacheValue === null) {
        cacheValue = 'KV_NULL';
      }

      // CF timeout must be at least 60 seconds, and 10x longer than the map timeout
      const kvTimeout = timeout * 10;
      // A value of 0 means that the cache will be stored forever
      const expirationTtl =
        kvTimeout >= 60000 ? Math.ceil(kvTimeout / 1000) : 0;

      // Non-blocking
      this.kvStore.put(key, JSON.stringify(cacheValue), {
        // CF time to live is in seconds
        ...(expirationTtl > 0 ? { expirationTtl } : undefined),
      });
    }
  }

  setSync(
    key: string,
    value: any,
    timeout: number = this.timeoutDefault,
  ): void {
    const pair = this.map.get(key);

    if (pair !== undefined) {
      clearTimeout(pair[0]);
    }

    // Only timeout from map, since KV has its own expiration
    const timer = timeout
      ? setTimeout(() => {
          this.map.delete(key);
        }, timeout)
      : 0;

    this.map.set(key, [timer, value]);
  }

  async delete(key: string): Promise<void> {
    this.deleteSync(key);

    if (this.kvStore) {
      await this.kvStore.delete(key);
    }
  }

  deleteSync(key: string): void {
    const pair = this.map.get(key);

    if (pair !== undefined) {
      clearTimeout(pair[0]);
      this.map.delete(key);
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  hasSync(key: string): boolean {
    return this.map.has(key);
  }

  async clear(prefix?: string): Promise<void> {
    if (prefix) {
      for (const [key, pair] of this.map.entries()) {
        if (key.startsWith(prefix)) {
          clearTimeout(pair[0]);
          this.map.delete(key);
        }
      }
    } else {
      // Clear all cache
      for (const pair of this.map.values()) {
        clearTimeout(pair[0]);
      }

      this.map.clear();
    }

    const { kvStore } = this;

    if (kvStore) {
      let cursor = '';
      let complete = false;

      while (!complete) {
        const response = await kvStore.list({
          prefix,
          cursor: cursor || undefined,
        });

        cursor = response.cursor ?? '';
        complete = response.list_complete;

        if (response.keys.length > 0) {
          await Promise.all(
            response.keys.map((key) => {
              return kvStore.delete(key.name);
            }),
          );
        }
      }
    }
  }
}
