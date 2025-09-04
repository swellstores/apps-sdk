import type { KVNamespace } from '@cloudflare/workers-types';
import { HtmlCache, type CacheRules } from './html-cache';
import { KVCacheBackend } from './html-cache-kv';
import { WorkerCacheBackend } from './html-cache-worker';

export type HtmlCacheEnv = {
  NAMESPACE?: KVNamespace;
  HTML_CACHE_EPOCH?: string;
  HTML_CACHE_BACKEND?: 'kv' | 'worker';
  HTML_CACHE_RULES?: CacheRules;
};

let _instance: HtmlCache | null = null;

export function getHtmlCache(env?: HtmlCacheEnv, cacheRules?: CacheRules): HtmlCache | null {
  const epoch = env?.HTML_CACHE_EPOCH;
  if (typeof epoch !== 'string' || !epoch) return null;

  if (_instance) return _instance;

  const kv = env?.NAMESPACE;
  // Use provided cacheRules, or from env, or defaults (handled by HtmlCache constructor)
  const rules = cacheRules || env?.HTML_CACHE_RULES;

  if (env?.HTML_CACHE_BACKEND !== 'worker' && kv) {
    _instance = new HtmlCache(epoch, new KVCacheBackend(kv), rules);
    return _instance;
  }

  // Fallback: POP-local Worker Cache
  _instance = new HtmlCache(epoch, new WorkerCacheBackend(epoch), rules);
  return _instance;
}
