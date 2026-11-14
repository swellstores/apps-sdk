import { requireString, validateUrl } from './context.js';
import type { HeaderReader } from './context.js';
import { SwellError } from './error.js';
import { getVerificationKey } from './jwks.js';
import type { StoreUser } from './store-user.js';

/** Where an app component made the request from. */
export type SwellSurface = 'admin' | 'checkout' | 'storefront';
const SURFACES: readonly unknown[] = ['admin', 'checkout', 'storefront'];
/** A storefront request's deployment mode. */
export type SwellStorefrontMode = 'live' | 'preview' | 'editor';
const MODES: readonly unknown[] = ['live', 'preview', 'editor'];
// host[:port], lowercase: what Swell puts in storefront_host
const HOST_RE = /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::\d{1,5})?$/;
// An IPv4 or IPv6 address as Swell writes client_ip (shape only: the claim is signed)
const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9A-Fa-f:.]{2,45})$/;

export interface SwellHeadersEnv {
  SWELL_VERIFY_HEADERS?: string;
  SWELL_HEADERS_JWKS_URL?: string;
}

export interface VerifySwellContextOptions {
  /** Explicit Worker bindings or server configuration. Omit to read process.env when available. */
  env?: SwellHeadersEnv;
  /** Expected destination IDs from trusted app configuration, never incoming headers. */
  appId?: string;
  storeId?: string;
  /** Trusted vault override; the unsigned Swell-Vault-Url header is not used. */
  vaultUrl?: string;
}

/** Request-local server data. Only getStorefrontConfig's projection may be sent to the browser. */
export interface SwellRequestContext {
  readonly storeId: string;
  readonly appId: string;
  readonly installationId: string;
  readonly environmentId?: string;
  readonly storefrontId?: string;
  /** Set when an app component made the request, or the storefront app proxy forwarded it ('storefront'). */
  readonly surface?: SwellSurface;
  /** The storefront host the shopper used (custom domains included), on storefront requests. */
  readonly storefrontHost?: string;
  /** The logged-in customer on a storefront request. Says who is logged in, not what they may see. */
  readonly accountId?: string;
  /** The storefront's deployment mode on a storefront request. */
  readonly mode?: SwellStorefrontMode;
  /**
   * The shopper's IP address on a storefront request, as Swell's own rate limits take it. Through the storefront app
   * proxy the app's server only sees Swell's, so rate-limit storefront routes on this.
   */
  readonly clientIp?: string;
  readonly apiHost: string;
  readonly adminUrl: string;
  readonly accessToken?: string;
  readonly publicKey?: string;
  readonly requestId?: string;
  readonly vaultUrl?: string;
  readonly storeUser: Readonly<StoreUser> | null;
  /** False only when trusted runtime configuration explicitly disables verification. */
  readonly signatureVerified: boolean;
}

function invalidContext(): SwellError {
  return new SwellError('Missing or invalid Swell context', { status: 401, code: 'invalid_swell_context' });
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalidContext();
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidContext();
}

/**
 * Resolves Swell-Context once per request. Uses ES256 and a pinned JWKS endpoint;
 * never discovers keys from the request. No fallback to plain headers or dashboard cookies.
 */
export async function verifySwellContext(headers: HeaderReader, options: VerifySwellContextOptions = {}): Promise<SwellRequestContext> {
  const runtime = globalThis as typeof globalThis & { process?: { env?: SwellHeadersEnv } };
  const env = options.env ?? runtime.process?.env ?? {};
  const verify = env.SWELL_VERIFY_HEADERS !== 'false';
  const jwksUrl = validateUrl(env.SWELL_HEADERS_JWKS_URL ?? 'https://keys.swell.store/jwks.json', 'SWELL_HEADERS_JWKS_URL');
  for (const field of ['appId', 'storeId'] as const) {
    if (options[field] !== undefined) requireString(options[field], field);
  }
  const vaultUrl = options.vaultUrl === undefined ? undefined : validateUrl(options.vaultUrl, 'vaultUrl');
  const token = headers.get('Swell-Context');
  if (!token || token.length > 16_384) throw invalidContext();
  let payload: Record<string, unknown>;
  let header: Record<string, unknown>;
  let signature: Uint8Array;
  const parts = token.split('.');
  try {
    if (parts.length !== 3) throw invalidContext();
    header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[0]))) as Record<string, unknown>;
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[1]))) as Record<string, unknown>;
    object(header); object(payload);
    signature = decode(parts[2]);
    if (header.alg !== 'ES256' || typeof header.kid !== 'string' || !header.kid || header.crit !== undefined || header.b64 !== undefined || signature.length !== 64) throw invalidContext();
  } catch { throw invalidContext(); }

  if (verify) {
    const key = await getVerificationKey(jwksUrl, header.kid as string);
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw invalidContext();
  }

  try {
    const now = Date.now() / 1000;
    // The issuer controls token lifetime; allow five seconds for clock skew.
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > now + 5 ||
        typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= now - 5 ||
        payload.exp <= payload.iat) throw invalidContext();
    if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || !Number.isFinite(payload.nbf) || payload.nbf > now + 5)) throw invalidContext();
    for (const field of ['store_id', 'app_id', 'installation_id']) requireString(payload[field], field);
    if (payload.aud !== payload.app_id || (options.appId !== undefined && payload.aud !== options.appId) ||
        (options.storeId !== undefined && payload.store_id !== options.storeId)) throw invalidContext();
    for (const field of ['environment_id', 'storefront_id']) {
      if (payload[field] != null) requireString(payload[field], field);
    }
    if (payload.surface != null && !SURFACES.includes(payload.surface)) throw invalidContext();
    if (payload.storefront_host != null && (typeof payload.storefront_host !== 'string' || !HOST_RE.test(payload.storefront_host))) throw invalidContext();
    if (payload.account_id != null) requireString(payload.account_id, 'account_id');
    if (payload.mode != null && !MODES.includes(payload.mode)) throw invalidContext();
    if (payload.client_ip != null && (typeof payload.client_ip !== 'string' || !IP_RE.test(payload.client_ip))) throw invalidContext();
    let storeUser: Readonly<StoreUser> | null = null;
    if (payload.admin !== null) {
      object(payload.admin);
      requireString(payload.admin.user_id, 'admin.user_id');
      storeUser = Object.freeze({ userId: payload.admin.user_id, storeId: payload.store_id as string });
    }
    return Object.freeze({
      storeId: payload.store_id as string, appId: payload.app_id as string,
      installationId: payload.installation_id as string,
      environmentId: (payload.environment_id as string | null | undefined) ?? undefined,
      storefrontId: (payload.storefront_id as string | null | undefined) ?? undefined,
      surface: (payload.surface as SwellSurface | null | undefined) ?? undefined,
      storefrontHost: (payload.storefront_host as string | null | undefined) ?? undefined,
      accountId: (payload.account_id as string | null | undefined) ?? undefined,
      mode: (payload.mode as SwellStorefrontMode | null | undefined) ?? undefined,
      clientIp: (payload.client_ip as string | null | undefined) ?? undefined,
      apiHost: validateUrl(payload.api_host, 'api_host'), adminUrl: validateUrl(payload.admin_url, 'admin_url'),
      accessToken: headers.get('Swell-Access-Token') ?? undefined,
      publicKey: headers.get('Swell-Public-Key') ?? undefined,
      requestId: headers.get('Swell-Request-ID') ?? undefined,
      vaultUrl, storeUser, signatureVerified: verify,
    });
  } catch { throw invalidContext(); }
}

/**
 * True for a request a shopper's storefront page made through Swell: the storefront app proxy, or a storefront app
 * block's component. It says which store and storefront the request came from (`storeId`, `storefrontId`,
 * `storefrontHost`), so an app needs no list of allowed origins. It does not identify a person: treat the request as
 * public, and check `accountId` before returning a customer's data.
 */
export function isStorefrontRequest(context: SwellRequestContext): boolean {
  return context.surface === 'storefront' && typeof context.storefrontId === 'string' && context.storefrontId.length > 0;
}
