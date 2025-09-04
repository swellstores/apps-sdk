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

export function getHtmlCache(
  env?: HtmlCacheEnv,
  cacheRules?: CacheRules,
): HtmlCache | null {
  const epoch = env?.HTML_CACHE_EPOCH;
  if (typeof epoch !== 'string' || !epoch) return null;

  const kv = env?.NAMESPACE;
  const rules = cacheRules || env?.HTML_CACHE_RULES;
  if (env?.HTML_CACHE_BACKEND !== 'worker' && kv) {
    return new HtmlCache(epoch, new KVCacheBackend(kv), rules);
  }
  return new HtmlCache(epoch, new WorkerCacheBackend(epoch), rules);
}
