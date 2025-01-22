import type { CFWorkerKV } from 'types/swell';

/**
 * CloudFlare Workers KV adapter for Keyv.
 * Includes namespacing to prevent conflicts within shared storage.
 */
export class CFWorkerKVKeyvAdapter {
  private namespace: string; // magically passed in from Keyv
  private store: CFWorkerKV;

  constructor(store: CFWorkerKV) {
    this.store = store;

    // keyv will override namespace at runtime
    this.namespace = 'dummy';
  }

  async has(key: string) : Promise<boolean> {
    return this.get(key) !== undefined;
  }

  async get(key: string) : Promise<any> {
    return this.store.get(key);
  }

  async set(key: string, value: any) : Promise<any> {
    return this.store.put(key, value);
  }

  async delete(key: string) : Promise<void> {
    await this.store.delete(key);
  }

  async clear() : Promise<void> {
    // store.clear() would reset the entire cache, but in this case
    // we only want to clear entries within the given namespace.
    // Note: If the cache is large, then this will not scale

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
}
