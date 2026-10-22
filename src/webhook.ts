import { requireString, validateUrl } from './context.js';
import type { HeaderReader } from './context.js';
import { SwellError } from './error.js';
import { getVerificationKey } from './jwks.js';
import type { SwellHeadersEnv } from './request-context.js';

const SIGNATURE_TYPE = 'swell-webhook+jwt';

export interface VerifySwellWebhookOptions {
  /** Explicit Worker bindings or server configuration. Omit to read process.env when available. */
  env?: SwellHeadersEnv;
  /** Expected sender from trusted configuration, never incoming headers. Pass this or `appId`. */
  storeId?: string;
  /** The id in swell.json of the app the webhook must belong to. Pass this or `storeId`. */
  appId?: string;
}

/** A webhook request Swell sent, with its event. */
export interface SwellWebhook {
  readonly storeId: string;
  readonly environmentId?: string;
  /** Set for an app's webhook: the id in the app's swell.json. */
  readonly appId?: string;
  readonly webhookId?: string;
  readonly eventId?: string;
  /** The event, as the body sent it. */
  readonly event: Readonly<Record<string, unknown>>;
  /** False only when trusted runtime configuration explicitly disables verification. */
  readonly signatureVerified: boolean;
}

function invalidWebhook(): SwellError {
  return new SwellError('Missing or invalid Swell webhook signature', { status: 401, code: 'invalid_swell_webhook' });
}

function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw invalidWebhook();
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}

function object(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidWebhook();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value == null) return undefined;
  requireString(value, field);
  return value;
}

async function sha256(body: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  return btoa(String.fromCharCode(...hash)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Verifies the Swell-Signature of a webhook request and reads its event. The
 * body must be the bytes the request carried, before any parsing. Uses ES256
 * and the same pinned JWKS endpoint as verifySwellContext.
 */
export async function verifySwellWebhook(headers: HeaderReader, body: string | ArrayBuffer | ArrayBufferView, options: VerifySwellWebhookOptions = {}): Promise<SwellWebhook> {
  const runtime = globalThis as typeof globalThis & { process?: { env?: SwellHeadersEnv } };
  const env = options.env ?? runtime.process?.env ?? {};
  const verify = env.SWELL_VERIFY_HEADERS !== 'false';
  const jwksUrl = validateUrl(env.SWELL_HEADERS_JWKS_URL ?? 'https://keys.swell.store/jwks.json', 'SWELL_HEADERS_JWKS_URL');
  for (const field of ['appId', 'storeId'] as const) {
    if (options[field] !== undefined) requireString(options[field], field);
  }
  // A signature proves that Swell sent the request, not whose webhook it is:
  // any store can point a webhook at any address
  if (options.appId === undefined && options.storeId === undefined) {
    throw new Error('verifySwellWebhook needs options.appId or options.storeId');
  }
  // A parsed body no longer has the bytes the signature covers
  if (typeof body !== 'string' && !(body instanceof ArrayBuffer) && !ArrayBuffer.isView(body)) {
    throw new TypeError('verifySwellWebhook needs the body as the request carried it, a string or bytes');
  }
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body)
    : body instanceof ArrayBuffer ? new Uint8Array(body)
      : new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  const token = headers.get('Swell-Signature');
  if (!token || token.length > 16_384) throw invalidWebhook();
  let payload: Record<string, unknown>;
  let header: Record<string, unknown>;
  let signature: Uint8Array;
  const parts = token.split('.');
  try {
    if (parts.length !== 3) throw invalidWebhook();
    header = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[0]))) as Record<string, unknown>;
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(parts[1]))) as Record<string, unknown>;
    object(header); object(payload);
    signature = decode(parts[2]);
    if (header.alg !== 'ES256' || header.typ !== SIGNATURE_TYPE || typeof header.kid !== 'string' || !header.kid ||
        header.crit !== undefined || header.b64 !== undefined || signature.length !== 64) throw invalidWebhook();
  } catch { throw invalidWebhook(); }

  if (verify) {
    const key = await getVerificationKey(jwksUrl, header.kid as string, 'invalid_swell_webhook');
    if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw invalidWebhook();
  }

  try {
    const now = Date.now() / 1000;
    // The issuer controls signature lifetime; allow five seconds for clock skew.
    if (typeof payload.iat !== 'number' || !Number.isFinite(payload.iat) || payload.iat > now + 5 ||
        typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || payload.exp <= now - 5 ||
        payload.exp <= payload.iat) throw invalidWebhook();
    requireString(payload.store_id, 'store_id');
    requireString(payload.body_sha256, 'body_sha256');
    const appId = optionalString(payload.app_id, 'app_id');
    if ((options.storeId !== undefined && payload.store_id !== options.storeId) ||
        (options.appId !== undefined && appId !== options.appId)) throw invalidWebhook();
    if (payload.body_sha256 !== await sha256(bytes)) throw invalidWebhook();
    const event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    object(event);
    return Object.freeze({
      storeId: payload.store_id as string,
      environmentId: optionalString(payload.environment_id, 'environment_id'),
      appId,
      webhookId: optionalString(payload.webhook_id, 'webhook_id'),
      eventId: optionalString(payload.event_id, 'event_id'),
      event: Object.freeze(event),
      signatureVerified: verify,
    });
  } catch { throw invalidWebhook(); }
}
