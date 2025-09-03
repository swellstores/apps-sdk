import type { KVNamespace } from '@cloudflare/workers-types';
import { HtmlCache } from './html-cache';
import { KVCacheBackend } from './html-cache-kv';
import { WorkerCacheBackend } from './html-cache-worker';

export type HtmlCacheEnv = {
  NAMESPACE?: KVNamespace;
  HTML_CACHE_EPOCH?: string;
  HTML_CACHE_BACKEND?: 'kv' | 'worker';
};

let _instance: HtmlCache | null = null;

export function getHtmlCache(env?: HtmlCacheEnv): HtmlCache | null {
  const epoch = env?.HTML_CACHE_EPOCH;
  if (typeof epoch !== 'string' || !epoch) return null;

  if (_instance) return _instance;

  const kv = env?.NAMESPACE;

  if (env?.HTML_CACHE_BACKEND !== 'worker' && kv) {
    _instance = new HtmlCache(epoch, new KVCacheBackend(kv));
    return _instance;
  }

  // Fallback: POP-local Worker Cache
  _instance = new HtmlCache(epoch, new WorkerCacheBackend(epoch));
  return _instance;
}
