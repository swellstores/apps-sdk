import { requireString, validateUrl } from './context.js';
import type { HeaderReader } from './context.js';
import { SwellError } from './error.js';
import { getVerificationKey } from './jwks.js';
import type { StoreUser } from './store-user.js';

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
      apiHost: validateUrl(payload.api_host, 'api_host'), adminUrl: validateUrl(payload.admin_url, 'admin_url'),
      accessToken: headers.get('Swell-Access-Token') ?? undefined,
      publicKey: headers.get('Swell-Public-Key') ?? undefined,
      requestId: headers.get('Swell-Request-ID') ?? undefined,
      vaultUrl, storeUser, signatureVerified: verify,
    });
  } catch { throw invalidContext(); }
}
