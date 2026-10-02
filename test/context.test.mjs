import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifySwellContext, requireStoreUser, getStorefrontConfig, SwellBackendAPI, SwellError } from '../dist/index.js';
import { createSigner } from './helpers/context.mjs';

const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });
const invalid = error => error instanceof SwellError && error.status === 401 && error.code === 'invalid_swell_context';
const unavailable = error => error instanceof SwellError && error.status === 503 && error.code === 'swell_jwks_unavailable';
let sequence = 0;
function fixture() {
  const signer = createSigner();
  const env = { SWELL_HEADERS_JWKS_URL: `https://keys-${++sequence}.test/.well-known/jwks.json` };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, env.SWELL_HEADERS_JWKS_URL);
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal instanceof AbortSignal);
    calls++;
    return Response.json({ keys: [signer.jwk] });
  };
  return { signer, env, calls: () => calls,
    resolve: (claims, options = {}, header) => verifySwellContext(new Headers({ 'Swell-Context': signer.token(claims, header) }), { env, ...options }) };
}

test('default verification pins production JWKS and shares keys, never request identity', async () => {
  const signer = createSigner(); let calls = 0;
  globalThis.fetch = async url => { assert.equal(url, 'https://keys.swell.store/jwks.json'); calls++; return Response.json({ keys: [signer.jwk] }); };
  const contexts = await Promise.all(['one', 'two'].map(store_id => verifySwellContext(new Headers({ 'Swell-Context': signer.token({ store_id, admin: { user_id: store_id } }) }), { env: {} })));
  assert.equal(calls, 1);
  assert.deepEqual(contexts.map(requireStoreUser), [{ storeId: 'one', userId: 'one' }, { storeId: 'two', userId: 'two' }]);
  assert.ok(contexts.every(context => context.signatureVerified && Object.isFrozen(context) && Object.isFrozen(context.storeUser)));
});

test('claims drive client routing and public projection despite conflicting unsigned headers', async () => {
  const { signer, env } = fixture();
  const headers = new Headers({ 'Swell-Context': signer.token({ storefront_id: 'front', environment_id: 'test' }),
    'Swell-Store-Id': 'forged', 'Swell-App-Id': 'forged', 'Swell-API-Host': 'https://forged.test',
    'Swell-Admin-Url': 'https://forged.test', 'Swell-Storefront-Id': 'forged', 'Swell-Vault-Url': 'https://forged.test',
    'Swell-Access-Token': 'token', 'Swell-Public-Key': 'pk', 'Swell-Request-ID': 'trace', 'Swell-Local-Dev': 'true' });
  const context = await verifySwellContext(headers, { env, appId: 'app', storeId: 'store' });
  assert.equal(context.environmentId, 'test'); assert.equal(context.installationId, 'installation');
  assert.equal(context.isLocalDev, undefined); assert.equal(context.vaultUrl, undefined);
  assert.deepEqual(requireStoreUser(context), { userId: 'user', storeId: 'store' });
  assert.throws(() => getStorefrontConfig(headers), /storeId/);
  assert.notEqual(getStorefrontConfig(context), getStorefrontConfig(context));
  assert.throws(() => new SwellBackendAPI({ context, headers }), /raw headers/);
  assert.deepEqual(getStorefrontConfig(context), { storeId: 'store', publicKey: 'pk', url: 'https://store.test',
    vaultUrl: 'https://vault.schema.io', headers: { 'Swell-Storefront-Id': 'front' } });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.test/settings/app');
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('store:token').toString('base64')}`);
    assert.equal(options.headers['Swell-Request-ID'], 'trace');
    return Response.json({ ok: true });
  };
  assert.deepEqual(await new SwellBackendAPI({ context }).settings(), { ok: true });
  for (const extra of [{ accessToken: 'override' }, { storeId: 'override' }, { secretKey: 'override' }]) {
    assert.throws(() => new SwellBackendAPI({ context, ...extra }), /mutually exclusive/);
  }
});

test('context and store user do not require API credentials; each client validates its own needs', async () => {
  const { resolve, signer, env } = fixture();
  const context = await resolve();
  assert.deepEqual(requireStoreUser(context), { storeId: 'store', userId: 'user' });
  assert.throws(() => new SwellBackendAPI({ context }), /accessToken/);
  assert.throws(() => getStorefrontConfig(context), /publicKey/);
  const configOnly = await verifySwellContext(new Headers({ 'Swell-Context': signer.token({ admin: null }), 'Swell-Public-Key': 'pk' }), { env, vaultUrl: 'http://vault.test' });
  assert.equal(getStorefrontConfig(configOnly).vaultUrl, 'http://vault.test');
  assert.equal(getStorefrontConfig(configOnly).headers, undefined);
  assert.equal(configOnly.storeUser, null);
  assert.throws(() => requireStoreUser(configOnly), error => error.status === 401 && error.code === 'store_user_required');
});

test('verification rejects tampered payloads, signatures and another signing key', async () => {
  const { signer, env } = fixture();
  const parts = signer.token().split('.');
  const changed = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1], 'base64url')), admin: { user_id: 'forged' } })).toString('base64url');
  const signature = Buffer.from(parts[2], 'base64url'); signature[0] ^= 1;
  const other = createSigner();
  for (const token of [`${parts[0]}.${changed}.${parts[2]}`, `${parts[0]}.${parts[1]}.${signature.toString('base64url')}`, other.token({}, { kid: signer.jwk.kid })]) {
    await assert.rejects(verifySwellContext(new Headers({ 'Swell-Context': token }), { env }), invalid);
  }
});

test('claim validation binds optional trusted destination and enforces token lifetime; issuer is not checked', async () => {
  const { resolve } = fixture(); const now = Math.floor(Date.now() / 1000);
  for (const claims of [
    { aud: 'other' }, { aud: ['app'] }, { app_id: '' }, { store_id: '' },
    { installation_id: null }, { api_host: 'ftp://bad' }, { admin_url: '/relative' }, { environment_id: 7 }, { storefront_id: {} },
    { admin: {} }, { admin: false }, { admin: { user_id: '' } }, { admin: undefined },
    { exp: now - 6, iat: now - 66 }, { exp: null }, { exp: 'tomorrow' }, { iat: null },
    { iat: now + 10, exp: now + 60 }, { exp: now }, { nbf: now + 10 }, { nbf: 'soon' },
  ]) await assert.rejects(resolve(claims), invalid);
  await assert.rejects(resolve({}, { appId: 'other' }), invalid);
  await assert.rejects(resolve({}, { storeId: 'other' }), invalid);
  assert.ok(await resolve({}, { appId: 'app', storeId: 'store' }));
  assert.ok(await resolve({ iat: now - 61, exp: now - 1 })); // small clock skew
  for (const iss of ['https://other.test', undefined]) assert.ok(await resolve({ iss }));
});

test('the issuer controls token lifetime; expiry is still enforced', async t => {
  const { resolve } = fixture();
  let now = Math.floor(Date.now() / 1000) * 1000; t.mock.method(Date, 'now', () => now);
  const claims = { iat: now / 1000, exp: now / 1000 + 120 };
  assert.ok(await resolve(claims));
  now += 90_000;
  assert.ok(await resolve(claims));
  now += 36_000; // expired beyond the five-second clock tolerance
  await assert.rejects(resolve(claims), invalid);
});

test('malformed JWTs and unsupported JOSE headers fail without fetching keys', async () => {
  const { signer, env } = fixture();
  globalThis.fetch = () => assert.fail('unexpected fetch');
  const parts = signer.token().split('.');
  for (const token of ['', 'x', 'a.b.c', `${parts[0]}.${parts[1]}.AA`, `${parts[0]}=.${parts[1]}.${parts[2]}`, 'x'.repeat(16385),
    signer.token({}, { alg: 'none' }), signer.token({}, { alg: 'HS256' }), signer.token({}, { kid: '' }),
    signer.token({}, { crit: ['custom'] }), signer.token({}, { b64: false }),
    `bnVsbA.${parts[1]}.${parts[2]}`, `${parts[0]}.W10.${parts[2]}`,
  ]) await assert.rejects(verifySwellContext(new Headers({ 'Swell-Context': token }), { env }), invalid);
  await assert.rejects(verifySwellContext(new Headers(), { env }), invalid);
});

test('local bypass requires exactly false and skips keys, but retains claim validation', async () => {
  const { signer, env } = fixture();
  const token = signer.token().split('.');
  token[2] = Buffer.alloc(64).toString('base64url');
  const headers = new Headers({ 'Swell-Context': token.join('.'), 'SWELL_VERIFY_HEADERS': 'false' });
  for (const value of [undefined, 'true', '', '0', 'FALSE', ' false ', false]) {
    await assert.rejects(verifySwellContext(headers, { env: { ...env, SWELL_VERIFY_HEADERS: value } }), invalid);
  }
  globalThis.fetch = () => assert.fail('bypass must not fetch');
  const disabled = { ...env, SWELL_VERIFY_HEADERS: 'false' };
  const context = await verifySwellContext(headers, { env: disabled });
  assert.equal(context.signatureVerified, false);
  assert.deepEqual(requireStoreUser(context), { userId: 'user', storeId: 'store' });
  await assert.rejects(verifySwellContext(headers, { env: disabled, appId: 'other' }), invalid);
  for (const claims of [{ exp: 1 }, { admin: true }, { store_id: '' }]) {
    await assert.rejects(verifySwellContext(new Headers({ 'Swell-Context': signer.token(claims) }), { env: disabled }), invalid);
  }
});

test('runtime env is read at call time; explicit env replaces it', async () => {
  const { signer, env } = fixture();
  const previous = process.env.SWELL_VERIFY_HEADERS;
  const previousUrl = process.env.SWELL_HEADERS_JWKS_URL;
  try {
    process.env.SWELL_VERIFY_HEADERS = 'false'; process.env.SWELL_HEADERS_JWKS_URL = env.SWELL_HEADERS_JWKS_URL;
    const headers = new Headers({ 'Swell-Context': signer.token() });
    assert.equal((await verifySwellContext(headers)).signatureVerified, false);
    assert.equal((await verifySwellContext(headers, { env })).signatureVerified, true);
    process.env.SWELL_VERIFY_HEADERS = 'true';
    assert.equal((await verifySwellContext(headers)).signatureVerified, true);
  } finally {
    if (previous === undefined) delete process.env.SWELL_VERIFY_HEADERS; else process.env.SWELL_VERIFY_HEADERS = previous;
    if (previousUrl === undefined) delete process.env.SWELL_HEADERS_JWKS_URL; else process.env.SWELL_HEADERS_JWKS_URL = previousUrl;
  }
});

test('JWKS override is trusted configuration, not a token or plain-header URL', async () => {
  const { signer, env } = fixture();
  const headers = new Headers({ 'Swell-Context': signer.token({}, { jku: 'https://evil.test/keys' }), 'Swell-Headers-Jwks-Url': 'https://evil.test/keys' });
  assert.ok(await verifySwellContext(headers, { env }));
  for (const url of ['', '/relative', 'ftp://host/keys', 'https://user:pass@host/keys', 'https://host/keys?query=1']) {
    await assert.rejects(verifySwellContext(headers, { env: { SWELL_HEADERS_JWKS_URL: url } }), /SWELL_HEADERS_JWKS_URL/);
  }
});

test('JWKS cache deduplicates concurrent fetches, refreshes rotation and limits unknown-kid fetches', async t => {
  const { resolve, env, signer, calls } = fixture();
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  await Promise.all(Array.from({ length: 8 }, () => resolve())); assert.equal(calls(), 1);
  await resolve(); assert.equal(calls(), 1);
  const replacement = createSigner();
  let refreshes = 0;
  globalThis.fetch = async () => { refreshes++; return Response.json({ keys: [signer.jwk, replacement.jwk] }); };
  const rotated = () => verifySwellContext(new Headers({ 'Swell-Context': replacement.token() }), { env });
  await assert.rejects(rotated(), invalid); assert.equal(refreshes, 0);
  now += 30_001;
  await Promise.all([rotated(), rotated()]); assert.equal(refreshes, 1);
  for (let i = 0; i < 10; i++) await assert.rejects(resolve({}, {}, { kid: `unknown-${i}` }), invalid);
  assert.equal(refreshes, 1);
  now += 300_001;
  await resolve(); assert.equal(refreshes, 2);
});

test('expired keys fail closed during outages and failed fetches have a cooldown', async t => {
  const { resolve } = fixture(); let now = Date.now(); t.mock.method(Date, 'now', () => now);
  await resolve();
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error('offline'); };
  await resolve(); assert.equal(calls, 0); // usable public keys survive a brief outage
  now += 300_001;
  await assert.rejects(resolve(), unavailable);
  await assert.rejects(resolve(), unavailable); assert.equal(calls, 1);
  now += 1_001;
  await assert.rejects(resolve(), unavailable); assert.equal(calls, 2);
});

test('a cold key fetch recovers one second after failure and deduplicates retries', async t => {
  const { resolve, signer } = fixture();
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  let calls = 0;
  globalThis.fetch = async () => { calls++; now += 5000; throw new Error('timeout'); };
  await Promise.all(Array.from({ length: 8 }, () => assert.rejects(resolve(), unavailable)));
  assert.equal(calls, 1);
  globalThis.fetch = async () => { calls++; return Response.json({ keys: [signer.jwk] }); };
  now += 999;
  await assert.rejects(resolve(), unavailable); assert.equal(calls, 1);
  now += 1;
  const contexts = await Promise.all(Array.from({ length: 8 }, () => resolve()));
  assert.ok(contexts.every(context => context.signatureVerified));
  assert.equal(calls, 2);
});

test('JWKS failures, empty keys and invalid key material are service errors, never bypass', async () => {
  for (const response of [() => new Response('', { status: 302 }), () => new Response('', { status: 500 }),
    () => new Response('not json'), () => Response.json({ keys: [] }), () => Response.json({}),
    () => Response.json({ keys: [{ kid: 'bad', kty: 'EC', crv: 'P-256', x: 'invalid', y: 'invalid' }] })]) {
    const { resolve } = fixture(); globalThis.fetch = async () => response(); await assert.rejects(resolve(), unavailable);
  }
});

test('a pending rotation refresh cannot block requests using fresh cached keys', { timeout: 1000 }, async t => {
  const { resolve } = fixture(); let now = Date.now(); t.mock.method(Date, 'now', () => now);
  await resolve(); now += 30_001;
  let rejectRefresh;
  globalThis.fetch = () => new Promise((_resolve, reject) => { rejectRefresh = reject; });
  t.after(() => rejectRefresh?.(new Error('offline')));
  const refreshing = assert.rejects(resolve({}, {}, { kid: 'unknown' }), unavailable);
  assert.equal((await resolve()).signatureVerified, true);
  rejectRefresh(new Error('offline'));
  await refreshing;
  assert.equal((await resolve()).signatureVerified, true);
});
