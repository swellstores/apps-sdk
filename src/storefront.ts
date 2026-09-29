import './guard.js';
import swell from 'swell-js';
import type { PublicConfig, SwellClient } from 'swell-js';
import { requireString, validateUrl } from './context.js';

export interface CookieOptions {
  path?: string;
  maxAge?: number;
  sameSite?: 'lax' | 'strict' | 'none';
  domain?: string;
  expires?: Date;
  secure?: boolean;
  httpOnly?: boolean;
  [attribute: string]: string | number | boolean | Date | undefined;
}
export interface CookieAdapter {
  /** Return decoded current values, including this request's writes/deletes. The adapter owns state. */
  get(name: string): string | undefined;
  /** Owns write policy: may skip a write, or throw when required persistence is unavailable. */
  set?(name: string, value: string, options: CookieOptions): void;
}
export interface StorefrontOptions {
  cookies: CookieAdapter;
  /** Replaces native defaults (/, one week, SameSite=Lax). Use {} for adapter-owned policy. */
  cookieOptions?: CookieOptions;
}

/** Creates an isolated native swell-js client. Replace request before first use to add caching. */
export function createStorefrontClient(config: PublicConfig<'camel'> & { useCamelCase: true }, options: StorefrontOptions): SwellClient<'camel'>;
export function createStorefrontClient<C extends 'snake' | 'camel' = 'snake'>(config: PublicConfig<C>, options: StorefrontOptions): SwellClient<C>;
export function createStorefrontClient(config: PublicConfig, { cookies, cookieOptions = { path: '/', maxAge: 604800, sameSite: 'lax' } }: StorefrontOptions): SwellClient<any> {
  for (const field of ['getCookie', 'setCookie', 'getCart', 'updateCart']) {
    if (field in config) throw new Error(`Invalid public config callback: ${field}`);
  }
  requireString(config.storeId, 'storeId');
  requireString(config.publicKey, 'publicKey');
  for (const field of ['url', 'vaultUrl'] as const) {
    if (config[field] !== undefined) validateUrl(config[field], field);
  }
  for (const field of ['locale', 'currency', 'session', 'store', 'key'] as const) {
    if (config[field] !== undefined && typeof config[field] !== 'string') throw new Error(`Invalid ${field}`);
  }
  for (const field of ['useCamelCase', 'previewContent'] as const) {
    if (config[field] !== undefined && typeof config[field] !== 'boolean') throw new Error(`Invalid ${field}`);
  }
  if (config.timeout !== undefined && (!Number.isFinite(config.timeout) || config.timeout < 0)) throw new Error('Invalid timeout');
  if (config.headers !== undefined && (!config.headers || typeof config.headers !== 'object' || Array.isArray(config.headers) || Object.values(config.headers).some(value => typeof value !== 'string'))) throw new Error('Invalid headers');
  if (!cookies || typeof cookies.get !== 'function' || (cookies.set !== undefined && typeof cookies.set !== 'function')) throw new Error('A cookie adapter with get() and optional set() is required');
  return swell.create(config.storeId, config.publicKey, {
    ...config,
    headers: { ...config.headers },
    getCookie: name => cookies.get(name),
    setCookie(name, value, attributes = {}) {
      if (!cookies.set) throw new Error('Cannot write Swell cookies with a read-only adapter; use a writable route handler or action');
      const options: CookieOptions = { ...cookieOptions };
      for (const [key, value] of Object.entries(attributes)) {
        const normalized = ({ 'max-age': 'maxAge', maxage: 'maxAge', samesite: 'sameSite', httponly: 'httpOnly' } as Record<string, string>)[key.toLowerCase()] ?? key;
        options[normalized] = value;
      }
      return cookies.set(name, value, options);
    },
  });
}
