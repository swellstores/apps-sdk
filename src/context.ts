import type { PublicConfig } from 'swell-js';

export type HeaderReader = Pick<Headers, 'get'>;
export interface SwellContext {
  storeId?: string;
  appId?: string;
  environmentId?: string;
  storefrontId?: string;
  accessToken?: string;
  publicKey?: string;
  apiHost?: string;
  adminUrl?: string;
  vaultUrl?: string;
  requestId?: string;
  isLocalDev: boolean;
}

/** Parses trusted ingress headers; does not verify their signature. */
export function parseSwellHeaders(headers: HeaderReader): SwellContext {
  const read = (name: string) => headers.get(`Swell-${name}`) ?? undefined;
  return {
    storeId: read('Store-Id'), appId: read('App-Id'),
    environmentId: read('Environment-Id'), storefrontId: read('Storefront-Id'),
    accessToken: read('Access-Token'), publicKey: read('Public-Key'),
    apiHost: read('API-Host'), adminUrl: read('Admin-Url'),
    vaultUrl: read('Vault-Url'), requestId: read('Request-ID'),
    isLocalDev: read('Local-Dev') === 'true',
  };
}

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
export function getStorefrontConfig(headers: HeaderReader): PublicConfig {
  const context = parseSwellHeaders(headers);
  requireString(context.storeId, 'storeId');
  requireString(context.publicKey, 'publicKey');
  return {
    storeId: context.storeId, publicKey: context.publicKey,
    url: validateUrl(context.adminUrl, 'adminUrl'),
    vaultUrl: context.vaultUrl === undefined ? 'https://vault.schema.io' : validateUrl(context.vaultUrl, 'vaultUrl'),
    ...(context.storefrontId ? { headers: { 'Swell-Storefront-Id': context.storefrontId } } : {}),
  };
}
