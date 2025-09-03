// ABOUTME: Minimal KV wrapper for CF, Miniflare, and Memory implementations
// Handles only the environment differences without retry logic or complexity

import type { CFWorkerKV, CFThemeEnv } from '../../types/cloudflare';

export interface ClientKV {
  get(keys: string[]): Promise<Map<string, string | null>>;
  put(
    key: string,
    value: string,
    metadata?: Record<string, any>,
  ): Promise<void>;
}

export type KVFlavor = 'cf' | 'miniflare' | 'memory';

/**
 * Direct Cloudflare KV implementation - uses native bulk operations
 */
class CFKV implements ClientKV {
  constructor(private kv: CFWorkerKV) {}

  async get(keys: string[]): Promise<Map<string, string | null>> {
    if (keys.length === 0) {
      return new Map();
    }

    // Direct CF bulk operation - no retry, no chunking
    // Chunking will be handled at a higher level with size awareness
    const result = await this.kv.get(keys, 'text');

    // Ensure we always return a Map
    if (!(result instanceof Map)) {
      const map = new Map<string, string | null>();
      for (const key of keys) {
        map.set(key, null);
      }
      return map;
    }

    return result;
  }

  async put(
    key: string,
    value: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.kv.put(key, value, { metadata });
  }
}

/**
 * Miniflare KV implementation - works around missing bulk operations
 */
class MiniflareKV implements ClientKV {
  constructor(private kv: CFWorkerKV) {}

  async get(keys: string[]): Promise<Map<string, string | null>> {
    if (keys.length === 0) {
      return new Map();
    }

    const result = new Map<string, string | null>();

    // Execute all KV operations in parallel - workerd handles queueing
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.kv.get(key, 'text');
        result.set(key, value);
      }),
    );

    return result;
  }

  async put(
    key: string,
    value: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.kv.put(key, value, { metadata });
  }
}

/**
 * In-memory KV implementation for testing
 */
class MemoryKV implements ClientKV {
  private store = new Map<
    string,
    { value: string; metadata?: Record<string, any> }
  >();

  async get(keys: string[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>();

    for (const key of keys) {
      const entry = this.store.get(key);
      result.set(key, entry?.value ?? null);
    }

    return result;
  }

  async put(
    key: string,
    value: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.store.set(key, { value, metadata });
  }
}

/**
 * Factory function to create appropriate KV implementation
 */
export function createClientKV(
  env?: CFThemeEnv,
  flavor: KVFlavor = 'cf',
): ClientKV {
  // If we have a KV namespace, use it
  if (env?.THEME) {
    if (flavor === 'miniflare') {
      return new MiniflareKV(env.THEME);
    }
    return new CFKV(env.THEME);
  }

  // Fallback to memory implementation
  return new MemoryKV();
}
