import type { PublicConfig } from 'swell-js';
import type { SwellRequestContext } from './request-context.js';

export type HeaderReader = Pick<Headers, 'get'>;

export function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing or invalid ${field}`);
}

export function validateUrl(value: unknown, field: string): string {
  requireString(value, field);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${field}: expected an absolute HTTP(S) URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`Invalid ${field}: expected an HTTP(S) URL without credentials, query or fragment`);
  }
  return url.href.replace(/\/$/, '');
}

/** Projects only public configuration. Deliver it with Cache-Control: private, no-store. */
export function getStorefrontConfig(context: SwellRequestContext): PublicConfig {
  requireString(context.storeId, 'storeId');
  requireString(context.publicKey, 'publicKey');
  return {
    storeId: context.storeId, publicKey: context.publicKey,
    url: validateUrl(context.adminUrl, 'adminUrl'),
    vaultUrl: context.vaultUrl === undefined ? 'https://vault.schema.io' : validateUrl(context.vaultUrl, 'vaultUrl'),
    ...(context.storefrontId ? { headers: { 'Swell-Storefront-Id': context.storefrontId } } : {}),
  };
}
