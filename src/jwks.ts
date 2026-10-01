import { SwellError } from './error.js';

const CACHE_TTL = 300_000;
const REFRESH_INTERVAL = 30_000;
const MAX_URLS = 8;
interface KeySet {
  keys: Map<string, CryptoKey>;
  expiresAt: number;
  refreshAfter: number;
  pending?: Promise<void>;
  error?: SwellError;
}

// Public keys only: no tokens, credentials, identities or request results.
const keySets = new Map<string, KeySet>();

async function refresh(url: string, entry: KeySet): Promise<void> {
  entry.refreshAfter = Date.now() + REFRESH_INTERVAL;
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('JWKS request failed');
    const body = await response.json() as { keys?: (JsonWebKey & { kid?: string })[] };
    if (!Array.isArray(body?.keys)) throw new Error('Invalid JWKS');
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys) {
      if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || (jwk.alg && jwk.alg !== 'ES256') || (jwk.use && jwk.use !== 'sig')) continue;
      if (typeof jwk.kid !== 'string' || !jwk.kid || keys.has(jwk.kid) || jwk.d) throw new Error('Invalid JWKS key');
      keys.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
    }
    if (!keys.size) throw new Error('Empty JWKS');
    entry.keys = keys;
    entry.expiresAt = Date.now() + CACHE_TTL;
    entry.error = undefined;
  } catch {
    entry.error = new SwellError('Swell verification keys unavailable', { status: 503, code: 'swell_jwks_unavailable' });
    throw entry.error;
  }
}

export async function getVerificationKey(url: string, kid: string): Promise<CryptoKey> {
  let entry = keySets.get(url);
  if (!entry) {
    if (keySets.size >= MAX_URLS) keySets.delete(keySets.keys().next().value!);
    entry = { keys: new Map(), expiresAt: 0, refreshAfter: 0 };
    keySets.set(url, entry);
  }
  const now = Date.now();
  const cached = entry.keys.get(kid);
  if (cached && now < entry.expiresAt) return cached;
  if (entry.pending) {
    await entry.pending;
  } else if (now >= entry.expiresAt || !entry.keys.has(kid)) {
    if (now >= entry.refreshAfter) {
      entry.pending = refresh(url, entry);
      try { await entry.pending; } finally { entry.pending = undefined; }
    } else if (now >= entry.expiresAt) {
      throw entry.error ?? new SwellError('Swell verification keys unavailable', { status: 503, code: 'swell_jwks_unavailable' });
    }
  }
  const key = entry.keys.get(kid);
  if (!key) throw new SwellError('Unknown Swell signing key', { status: 401, code: 'invalid_swell_context' });
  return key;
}
