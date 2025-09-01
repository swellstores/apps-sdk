import type { KeyvStoreAdapter } from 'keyv';
import type { CFWorkerKV } from 'types/cloudflare';
import { logger, createTraceId } from '../utils/logger';

/**
 * CloudFlare Workers KV adapter for Keyv.
 * Includes namespacing to prevent conflicts within shared storage.
 */
export class CFWorkerKVKeyvAdapter implements KeyvStoreAdapter {
  private store: CFWorkerKV;
  public namespace: string; // magically passed in from Keyv
  public opts: unknown;

  constructor(store: CFWorkerKV) {
    this.store = store;

    this.opts = null;
    // keyv will override namespace at runtime
    this.namespace = 'dummy';
  }

  async has(key: string): Promise<boolean> {
    const stream = await this.store.get(key, 'stream');

    if (stream !== null) {
      await stream.cancel();
      return true;
    }

    return false;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const trace = createTraceId();
    logger.debug('[SDK] kv.get', { key, trace });
    const value = await this.store.get(key);
    // The adapter stores any value as a string,
    // so `null` means that the `key` does not exist in the KV.
    const result = value !== null ? (value as T) : undefined;
    logger.debug(`[SDK] kv.get ${value !== null ? 'HIT' : 'MISS'}`, {
      key,
      trace,
    });
    return result;
  }

  set(key: string, value: string, ttl?: number): Promise<void> {
    if (typeof ttl === 'number') {
      /**
       * The minimum expiration time is 60 seconds.
       * @see {@link https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys}
       */
      ttl = Math.max(60, ttl / 1000);
    }

    logger.debug('[SDK] kv.set', { key, ttl });
    return this.store.put(key, value, { expirationTtl: ttl });
  }

  async delete(key: string): Promise<boolean> {
    await this.store.delete(key);
    return true;
  }

  async clear(): Promise<void> {
    // store.clear() would reset the entire cache, but in this case
    // we only want to clear entries within the given namespace.
    // Note: If the cache is large, then this will not scale

    let cursor = '';
    let complete = false;
    const prefix = `${this.namespace}:`;

    do {
      const response = await this.store.list({
        prefix,
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
    } while (!complete);
  }

  on(
    _event: string,
    _listener: (...args: unknown[]) => void,
  ): CFWorkerKVKeyvAdapter {
    // This can be implemented if necessary.
    return this;
  }
}
