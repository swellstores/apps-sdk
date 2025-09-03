import type { CacheBackend, CachedEntry } from './html-cache-backend';

import { md5 } from '../../utils';

type KVNamespace = import('@cloudflare/workers-types').KVNamespace;

type KVValueV1 = {
  v: 1;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  cacheTimeISO: string;
  ttl: number;
  swr: number;
  etag?: string;
  lastModifiedUTC?: string;
};

type KVMetaV1 = {
  v: 1;
  cacheTimeISO: string;
  ttl: number;
  swr: number;
  etag?: string;
  lastModifiedUTC?: string;
};

export type KVCacheBackendOptions = {
  /**
   * Optional key prefix to help with namespacing and easier debugging.
   * Example: "html" -> "html:<hash>"
   */
  prefix?: string;

  /**
   * If true (default), the logical key will be hashed with md5 to ensure
   * it stays under the 512-byte KV key length limit and is URL-safe.
   */
  hashKeys?: boolean;

  /**
   * Safety headroom against the 25 MiB KV value limit.
   * Default ~24.5 MiB to leave some slack for encoding overhead.
   */
  maxValueBytes?: number;
};

/**
 * Cloudflare KV implementation of CacheBackend.
 * Stores the entire CachedEntry as a compact JSON blob (value),
 * and a tiny summary in metadata for potential future use.
 */
export class KVCacheBackend implements CacheBackend {
  private readonly kv: KVNamespace;
  private readonly prefix: string | undefined;
  private readonly hashKeys: boolean;
  private readonly maxValueBytes: number;

  constructor(kv: KVNamespace, opts: KVCacheBackendOptions = {}) {
    this.kv = kv;
    this.prefix = opts.prefix;
    this.hashKeys = opts.hashKeys !== false; // default true
    this.maxValueBytes = opts.maxValueBytes ?? Math.floor(24.5 * 1024 * 1024);
  }

  async read(key: string): Promise<CachedEntry | null> {
    const kvKey = this.makeKey(key);
    const value = await this.kv.get<KVValueV1>(kvKey, 'json');
    if (!value) return null;

    // Headers were stored as plain object; keep them as-is (lowercased recommended upstream)
    const entry: CachedEntry = {
      status: value.status,
      statusText: value.statusText,
      headers: value.headers,
      body: value.body,
      cacheTimeISO: value.cacheTimeISO,
      ttl: value.ttl,
      swr: value.swr,
      etag: value.etag,
      lastModifiedUTC: value.lastModifiedUTC,
    };
    return entry;
  }

  async write(
    key: string,
    entry: CachedEntry,
    hardExpireSeconds: number,
  ): Promise<void> {
    const kvKey = this.makeKey(key);

    // Persist the full entry as value JSON
    const payload: KVValueV1 = {
      v: 1,
      status: entry.status,
      statusText: entry.statusText,
      headers: entry.headers,
      body: entry.body,
      cacheTimeISO: entry.cacheTimeISO,
      ttl: entry.ttl,
      swr: entry.swr,
      etag: entry.etag,
      lastModifiedUTC: entry.lastModifiedUTC,
    };

    const json = JSON.stringify(payload);
    this.assertSize(json);

    // Keep a tiny summary in metadata (≤ 1 KB)
    const metadata: KVMetaV1 = {
      v: 1,
      cacheTimeISO: entry.cacheTimeISO,
      ttl: entry.ttl,
      swr: entry.swr,
      etag: entry.etag,
      lastModifiedUTC: entry.lastModifiedUTC,
    };

    await this.kv.put(kvKey, json, {
      expirationTtl: hardExpireSeconds + 60, // natural hard expiry after SWR + grace period
      metadata,
    });
  }

  async delete(key: string): Promise<void> {
    const kvKey = this.makeKey(key);
    await this.kv.delete(kvKey);
  }

  // ---- private helpers ----

  private makeKey(raw: string): string {
    const core = this.hashKeys ? md5(raw) : raw;
    return this.prefix ? `${this.prefix}:${core}` : core;
  }

  private assertSize(json: string) {
    // UTF-8 byte length (fast path; JS strings are UTF-16 but this is close enough for HTML.
    // If you need exact, use new TextEncoder().encode(json).length).
    const bytes =
      typeof TextEncoder !== 'undefined'
        ? new TextEncoder().encode(json).length
        : this.approxUtf8Bytes(json);

    if (bytes > this.maxValueBytes) {
      throw new Error(
        `KV value too large: ${bytes} bytes exceeds limit ${this.maxValueBytes} bytes`,
      );
    }
  }

  private approxUtf8Bytes(str: string): number {
    // Approximation: ASCII -> 1, others -> up to 3 bytes (BMP).
    // This errs on the low side for rare astral chars; prefer TextEncoder when available.
    let count = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code <= 0x7f) count += 1;
      else if (code <= 0x7ff) count += 2;
      else count += 3;
    }
    return count;
  }
}
