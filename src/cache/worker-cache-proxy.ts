// ABOUTME: Swell-bound proxy for Worker Cache API with typed get/put
// Provides secure, versioned, tenant-isolated keys and TTL enforcement

import type { Swell } from '@/api';
import type { SwellData } from '../../types/swell';
import { MAX_TTL, SHORT_TTL } from './constants';
import { md5 } from '../utils';
import { logger } from '../utils/logger';

// Internal constant cache name; isolated within Worker Cache API
const CACHE_NAME = 'swell-cache-v011';

// Stable cache origin; used only to construct a string key (no network request)
const CACHE_KEY_ORIGIN = 'https://cache.swell.store';

export class WorkerCacheProxy {
  private swell: Swell;

  constructor(swell: Swell) {
    this.swell = swell;
  }

  /**
   * Reads a JSON value from Worker Cache using a key built from path+query.
   * Returns null on miss or if running outside of a Worker environment.
   */
  async get<T>(
    path: string,
    query?: SwellData,
    opts?: { version?: string | null },
  ): Promise<T | null> {
    if (typeof caches === 'undefined') {
      return null;
    }

    const { keyUrl } = await this.buildKeyUrl(path, query, opts?.version);

    try {
      const cache = await caches.open(CACHE_NAME);
      const match = await cache.match(keyUrl);
      if (!match) return null;

      const data = (await match.json()) as T;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Stores a JSON value in Worker Cache under key built from path+query.
   * No-ops outside of a Worker environment.
   */
  async put<T>(
    path: string,
    query: SwellData | undefined,
    value: T,
    opts?: { version?: string | null },
  ): Promise<void> {
    if (typeof caches === 'undefined') {
      return;
    }

    const { keyUrl, hasVersion } = await this.buildKeyUrl(
      path,
      query,
      opts?.version,
    );

    const ttlMs = hasVersion ? MAX_TTL : SHORT_TTL;

    try {
      const cache = await caches.open(CACHE_NAME);

      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${Math.floor(ttlMs / 1000)}`,
        },
      });

      await cache.put(keyUrl, response);
      logger.debug('[SDK] cache put done', { keyUrl });
    } catch {
      // ignore cache write errors
    }
  }

  /**
   * Builds a deterministic key URL for Worker Cache from the backend API URL
   * composed using path and query. Includes tenant and auth isolation and an
   * optional version segment.
   */
  private async buildKeyUrl(
    path: string,
    query?: SwellData,
    explicitVersion?: string | null,
  ): Promise<{ keyUrl: string; hasVersion: boolean }> {
    // Compose full backend URL used for fingerprinting
    const apiHost = this.swell.backend?.apiHost;
    const endpointPath = String(path).startsWith('/')
      ? String(path).substring(1)
      : String(path);

    let queryString = '';
    if (query && this.swell.backend) {
      queryString = this.swell.backend.stringifyQuery(query);
    }

    const fullUrl = `${apiHost}/${endpointPath}${
      queryString ? `?${queryString}` : ''
    }`;

    // Tenant+auth isolation (joined then hashed)
    const instanceId = this.swell.instanceId || '';
    const authKey = String(this.swell.swellHeaders?.['swell-auth-key'] || '');
    const tenantHash = await this.sha256Hex(`${instanceId}|${authKey}`);

    // Version handling (optional)
    const version =
      explicitVersion !== undefined
        ? explicitVersion
        : this.swell.swellHeaders?.['theme-version-hash'] || null;

    const hasVersion = Boolean(version);
    const versionHash = hasVersion
      ? await this.sha256Hex(String(version))
      : null;

    // URL fingerprint
    const urlHash = await this.sha256Hex(fullUrl);

    // Final key URL string (no real network origin)
    const keyUrl = versionHash
      ? `${CACHE_KEY_ORIGIN}/v1/${tenantHash}/${versionHash}/${urlHash}`
      : `${CACHE_KEY_ORIGIN}/v1/${tenantHash}/${urlHash}`;

    return { keyUrl, hasVersion };
  }

  /**
   * SHA-256 digest with hex encoding. Requires Worker crypto; callers
   * should avoid invoking this outside of Worker code paths.
   */
  private async sha256Hex(input: string): Promise<string> {
    // Prefer Worker/Web Crypto API
    if (
      typeof crypto !== 'undefined' &&
      crypto.subtle &&
      crypto.subtle.digest
    ) {
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest(
        'SHA-256',
        encoder.encode(input),
      );
      const bytes = new Uint8Array(digest);
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    return md5(input);
  }
}
