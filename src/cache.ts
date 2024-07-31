// Cache prefers to use a Cloudflare KV store,
// but will fall back to an in-memory cache if one is not available.
// This class offers a subset interface of Map except with async methods, including:
// get(), set(), delete(), has()
//
// Map is used first, then CFWorkerKV to populate the map afterwards.

import { StorefrontResource } from './api';

export class Cache {
  private map: Map<string, any> = new Map();
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

  setValues(values: Array<any>) {
    this.map = new Map(values);
  }

  getValues() {
    return Array.from(this.map);
  }

  async get(key: string) {
    if (this.map.has(key)) {
      return this.map.get(key);
    }

    if (this.kvStore) {
      let cacheValue;

      //const start = Date.now();

      const value = await this.kvStore.get(key);

      try {
        // Null means undefined in KV
        if (value === null) {
          cacheValue = undefined;
        } else {
          cacheValue = JSON.parse(value);
          if (cacheValue === 'KV_NULL') {
            cacheValue = null;
          }
        }

        this.setSync(key, cacheValue, this.timeoutDefault);
      } catch (err: any) {
        console.error('Cache.get JSON.parse error', key, err.message, value);
      }

      //console.log('Cache.get kvStore TIMING', key, Date.now() - start);

      return cacheValue;
    }
  }

  getSync(key: string) {
    return this.map.get(key);
  }

  async set(key: string, value: any, timeout: number = this.timeoutDefault) {
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
      const expirationTtl = kvTimeout >= 60000 ? kvTimeout / 1000 : 0;

      // Non-blocking
      this.kvStore.put(key, JSON.stringify(cacheValue), {
        // CF time to live is in seconds
        ...(expirationTtl > 0 ? { expirationTtl } : undefined),
      });
    }
  }

  setSync(key: string, value: any, timeout: number = this.timeoutDefault) {
    this.map.set(key, value);

    // Only timeout from map, since KV has its own expiration
    setTimeout(() => {
      this.map.delete(key);
    }, timeout);
  }

  async delete(key: string) {
    this.map.delete(key);

    if (this.kvStore) {
      await this.kvStore.delete(key);
    }
  }

  deleteSync(key: string) {
    this.map.delete(key);
  }

  async has(key: string) {
    return this.get(key);
  }

  hasSync(key: string) {
    return this.map.has(key);
  }
}
