import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifySwellWebhook, SwellError } from '../dist/index.js';
import { createSigner } from './helpers/context.mjs';

const nativeFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = nativeFetch; });
const invalid = error => error instanceof SwellError && error.status === 401 && error.code === 'invalid_swell_webhook';
let sequence = 0;

// Signs a body as schema-api-server's webhook client does, for the webhook at `url`
function fixture() {
  const url = 'https://example.com/hooks/orders';
  const signer = createSigner();
  const env = { SWELL_HEADERS_JWKS_URL: `https://keys-webhook-${++sequence}.test/jwks.json` };
  globalThis.fetch = async url => {
    assert.equal(url, env.SWELL_HEADERS_JWKS_URL);
    return Response.json({ keys: [signer.jwk] });
  };
  const body = JSON.stringify({ id: 'event', type: 'order.created', data: { id: 'order' } }, null, 2);
  const signature = (claims = {}, header = {}, signedBody = body) => {
    const iat = Math.floor(Date.now() / 1000);
    return signer.sign({ typ: 'swell-webhook+jwt', ...header }, {
      aud: url, store_id: 'store', environment_id: null, webhook_id: 'webhook', event_id: 'event',
      body_sha256: createHash('sha256').update(signedBody).digest('base64url'), iat, exp: iat + 300, ...claims,
    });
  };
  const headers = (value) => new Headers({ 'Swell-Signature': value });
  return { env, url, body, signature, headers };
}

test('verifies a webhook request and reads its event', async () => {
  const { env, url, body, signature, headers } = fixture();
  const webhook = await verifySwellWebhook(headers(signature({ app_id: 'my_app' })), body, { env, url, storeId: 'store', appId: 'my_app' });
  assert.deepEqual({ ...webhook, event: { ...webhook.event } }, {
    storeId: 'store', environmentId: undefined, appId: 'my_app', webhookId: 'webhook', eventId: 'event',
    event: JSON.parse(body), signatureVerified: true,
  });
  assert.ok(Object.isFrozen(webhook));

  // The body as bytes verifies the same
  assert.equal((await verifySwellWebhook(headers(signature()), new TextEncoder().encode(body), { env, url, storeId: 'store' })).storeId, 'store');
  assert.equal((await verifySwellWebhook(headers(signature()), new TextEncoder().encode(body).buffer, { env, url, storeId: 'store' })).storeId, 'store');
});

test('needs the body as received, not parsed', async () => {
  const { env, url, body, signature, headers } = fixture();
  await assert.rejects(verifySwellWebhook(headers(signature()), JSON.parse(body), { env, url, storeId: 'store' }), TypeError);
});

test('refuses a changed body, another store or app, and an expired or foreign signature', async () => {
  const { env, url, body, signature, headers } = fixture();
  const iat = Math.floor(Date.now() / 1000) - 600;
  for (const [value, requestBody, options] of [
    [signature(), body.replace('order.created', 'order.paid'), {}],
    [signature(), body, { storeId: 'other' }],
    [signature({ app_id: 'my_app' }), body, { appId: 'other' }],
    [signature(), body, { appId: 'my_app' }],
    [signature({ iat, exp: iat + 300 }), body, {}],
    [signature({}, { typ: 'JWT' }), body, {}],
    [signature({}, { kid: 'unpublished' }), body, {}],
    [signature({ body_sha256: undefined }), body, {}],
    [signature({}, {}, '[]'), '[]', {}],
  ]) await assert.rejects(verifySwellWebhook(headers(value), requestBody, { env, url, storeId: 'store', ...options }), invalid);

  await assert.rejects(verifySwellWebhook(new Headers(), body, { env, url, storeId: 'store' }), invalid);
  const [encodedHeader, encodedPayload] = signature().split('.');
  await assert.rejects(verifySwellWebhook(headers(`${encodedHeader}.${encodedPayload}.${'A'.repeat(86)}`), body, { env, url, storeId: 'store' }), invalid);
});

test('a signature of another key under a published key id is refused', async () => {
  const { env, url, body, signature, headers } = fixture();
  const { kid } = JSON.parse(Buffer.from(signature().split('.')[0], 'base64url'));
  const iat = Math.floor(Date.now() / 1000);
  const forged = createSigner().sign({ typ: 'swell-webhook+jwt', kid }, {
    store_id: 'store', body_sha256: createHash('sha256').update(body).digest('base64url'), iat, exp: iat + 300,
  });
  await assert.rejects(verifySwellWebhook(headers(forged), body, { env, url, storeId: 'store' }), invalid);
});

test('needs the app or the store whose webhook it must be', async () => {
  const { env, url, body, signature, headers } = fixture();
  await assert.rejects(verifySwellWebhook(headers(signature()), body, { env, url }), { message: /appId or options\.storeId/ });
  await assert.rejects(verifySwellWebhook(headers(signature()), body), { message: /appId or options\.storeId/ });
});

test('refuses a request Swell signed for another endpoint, and needs the address the webhook is set to', async () => {
  const { env, url, body, signature, headers } = fixture();
  await assert.rejects(verifySwellWebhook(headers(signature({ aud: 'https://example.com/hooks/refunds' })), body, { env, url, storeId: 'store' }), invalid);
  await assert.rejects(verifySwellWebhook(headers(signature({ aud: ['https://example.com/hooks/orders'] })), body, { env, url, storeId: 'store' }), invalid);
  await assert.rejects(verifySwellWebhook(headers(signature()), body, { env, storeId: 'store' }), { message: /options\.url/ });
  await assert.rejects(verifySwellWebhook(headers(signature()), body, { env, url: '/hooks/orders', storeId: 'store' }), { message: /Invalid url/ });
});

test('takes the same address written another way, and a signature from before Swell named the endpoint', async () => {
  const { env, body, signature, headers } = fixture();
  const sameEndpoint = 'https://EXAMPLE.com:443/hooks/orders';
  assert.equal((await verifySwellWebhook(headers(signature()), body, { env, url: sameEndpoint, storeId: 'store' })).storeId, 'store');
  assert.equal((await verifySwellWebhook(headers(signature({ aud: undefined })), body, { env, url: sameEndpoint, storeId: 'store' })).storeId, 'store');
  // A fragment, or a URL object, names the same endpoint
  assert.equal((await verifySwellWebhook(headers(signature()), body, { env, url: `${sameEndpoint}#orders`, storeId: 'store' })).storeId, 'store');
  assert.equal((await verifySwellWebhook(headers(signature()), body, { env, url: new URL(sameEndpoint), storeId: 'store' })).storeId, 'store');
  // An object with the URL's href, as Next's request.nextUrl or a URL of another realm, as well
  const nextUrl = { get href() { return sameEndpoint; }, pathname: '/hooks/orders' };
  assert.equal((await verifySwellWebhook(headers(signature()), body, { env, url: nextUrl, storeId: 'store' })).storeId, 'store');
  assert.equal((await verifySwellWebhook(headers(signature({ aud: `${sameEndpoint}#hook` })), body, { env, url: sameEndpoint, storeId: 'store' })).storeId, 'store');
});

test('compares the query of the address too', async () => {
  const { env, body, signature, headers } = fixture();
  const url = 'https://example.com/hooks/orders?tenant=a';
  assert.equal((await verifySwellWebhook(headers(signature({ aud: url })), body, { env, url, storeId: 'store' })).storeId, 'store');
  await assert.rejects(verifySwellWebhook(headers(signature({ aud: 'https://example.com/hooks/orders?tenant=b' })), body, { env, url, storeId: 'store' }), invalid);
});
