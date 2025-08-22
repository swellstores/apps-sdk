// ABOUTME: Detects KV storage flavor based on runtime environment

import type { KVFlavor } from '../cache';
import type { CFThemeEnv } from '../../types/cloudflare';
import { logger } from './logger';

let cachedKVFlavor: KVFlavor | undefined;

/**
 * Get KV storage flavor. Priority: KV_FLAVOR env var > auto-detection > miniflare default
 */
export function getKVFlavor(workerEnv?: CFThemeEnv): KVFlavor {
  if (cachedKVFlavor) {
    return cachedKVFlavor;
  }

  // No KV binding = memory
  if (!workerEnv?.THEME) {
    cachedKVFlavor = 'memory';
    return cachedKVFlavor;
  }

  // Priority 1: Explicit KV_FLAVOR env var
  const kvFlavor = workerEnv.KV_FLAVOR as string | undefined;
  if (kvFlavor) {
    const flavorLower = String(kvFlavor).toLowerCase();

    switch (flavorLower) {
      case 'cloudflare':
      case 'cf':
        cachedKVFlavor = 'cf';
        break;
      case 'miniflare':
        cachedKVFlavor = 'miniflare';
        break;
      case 'memory':
        cachedKVFlavor = 'memory';
        break;
      default:
        logger.warn(`[KV] Unknown KV_FLAVOR: ${kvFlavor}, using miniflare`);
        cachedKVFlavor = 'miniflare';
    }
    return cachedKVFlavor;
  }

  // Priority 2: Auto-detect Cloudflare Workers
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.userAgent === 'Cloudflare-Workers'
    ) {
      cachedKVFlavor = 'cf';
      return cachedKVFlavor;
    }
  } catch {
    // Ignore navigator access errors
  }

  // Priority 3: Default to miniflare (safe for old versions without batch KV)
  cachedKVFlavor = 'miniflare';
  return cachedKVFlavor;
}

export function resetKVFlavorCache(): void {
  cachedKVFlavor = undefined;
}
