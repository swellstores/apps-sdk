import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SwellBackendAPI, SwellError } from '../dist/index.js';
import { createStorefrontClient } from '../dist/storefront.js';
const nativeFetch = globalThis.fetch;
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
afterEach(() => { globalThis.fetch = nativeFetch; });
const credentials = { storeId: 'store', secretKey: 'secret', apiHost: 'https://api.example.test' };
const config = { storeId: 'store', publicKey: 'pk_test' };
const backend = () => new SwellBackendAPI(credentials);

test('backend validates credentials, host and endpoint before fetch', async () => {
  globalThis.fetch = () => assert.fail('unexpected fetch');
  for (const bad of [{}, { ...credentials, secretKey: '' }, { ...credentials, accessToken: 'extra' }, { ...credentials, apiHost: undefined }, { ...credentials, apiHost: 'ftp://host' }, { headers: new Headers() }, { ...credentials, headers: new Headers() }]) assert.throws(() => new SwellBackendAPI(bad));
  const api = backend();
  for (const path of ['https://other.test/x', '//other.test/x', '\\other.test', 'https:foo', '/x#frag', '/x\ty', '/x\ny', '/x\u007f', 42]) await assert.rejects(api.get(path), /endpoint/);
});

test('backend normalizes empty and spaced paths and keeps dot segments on the configured host', async () => {
  const api = backend(); const urls = [];
  globalThis.fetch = async url => { urls.push(new URL(url).href); return Response.json({}); };
  for (const path of ['', '/', '/content/my page', 'products', '/a/../products', '/products?limit=1']) await api.get(path, path.includes('?') ? { page: 2 } : undefined);
  assert.deepEqual(urls, ['https://api.example.test/', 'https://api.example.test/', 'https://api.example.test/content/my%20page',
    'https://api.example.test/products', 'https://api.example.test/products', 'https://api.example.test/products?limit=1&page=2']);
});

test('backend auth is UTF-8, forwards request ID and encodes nested/array/null/undefined/Date GET values', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example.test/products?where%5Bid%5D&where%5Bname%5D=null&where%5Bdate_created%5D%5B%24gte%5D=2026-01-01T00%3A00%3A00.000Z&expand%5B0%5D=items&expand%5B1%5D=images');
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('store:tökén').toString('base64')}`);
    assert.equal(options.headers['Swell-Request-ID'], 'request');
    assert.equal(options.headers['User-Agent'], `swell-apps-sdk/${version}`);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers['Content-Length'], undefined);
    return Response.json({ count: 1 });
  };
  const where = { id: null, name: 'null', search: undefined, date_created: { $gte: new Date('2026-01-01') } };
  assert.deepEqual(await new SwellBackendAPI({ storeId: 'store', accessToken: 'tökén', apiHost: credentials.apiHost, requestId: 'request' }).get('/products', { where, expand: ['items', 'images'], search: undefined }), { count: 1 });
});

test('backend verbs, JSON/text bodies and structured errors preserve wrapper contracts', async () => {
  const api = backend(); let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(options.headers.Authorization, `Basic ${Buffer.from('store:secret').toString('base64')}`);
    assert.equal(options.headers['Content-Length'], undefined);
    if (options.method !== 'GET') assert.equal(options.body, '{"name":"東京"}');
    return new Response('  hello  ');
  };
  for (const method of ['get', 'post', 'put', 'delete']) assert.equal(await api[method]('/products', { name: '東京' }), 'hello');
  assert.equal(calls, 4);
  globalThis.fetch = async () => Response.json({ errors: { name: { message: 'required' } } });
  await assert.rejects(api.post('/products', {}), error => error instanceof SwellError && error.status === 400 && !!error.body.name);
  assert.ok((await api.get('/products')).errors);
  for (const status of [302, 401, 500]) {
    globalThis.fetch = async () => new Response('failed', { status, headers: { Location: 'https://other.test' } });
    await assert.rejects(api.get('/products'), error => error.status === status && error.message === 'GET /products\nfailed'
      && error.body === undefined && error.code === undefined);
  }
  const network = new TypeError('offline'); globalThis.fetch = async () => { throw network; };
  await assert.rejects(api.get('/products'), error => error === network);
  globalThis.fetch = async () => Response.json({ error: { code: 'transaction_conflict', message: 'Conflict' } }, { status: 409 });
  await assert.rejects(api.put('/products/1', {}), error => error.status === 409 && error.code === 'transaction_conflict'
    && error.body.error.message === 'Conflict' && error.message === 'PUT /products/1\nConflict');
  globalThis.fetch = async () => Response.json({ errors: { name: { code: 'REQUIRED' } } });
  await assert.rejects(api.put('/products/1', {}), error => error.status === 400 && error.code === undefined && error.body.name.code === 'REQUIRED');
  const error = new SwellError({ error: { code: 'transaction_conflict', message: 'Conflict' } }, { retry: false });
  assert.equal(error.message, 'Conflict'); assert.equal(error.isRetryable, true); assert.equal(error.retry, false);
});

test('helper validation failures support direct catch without making requests', async () => {
  const api = backend(); let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({}); };
  const settingsError = await api.settings().catch(error => error);
  assert.ok(settingsError instanceof Error);
  assert.match(settingsError.message, /appId/);
  const workflowError = await api.workflows.create('sync', new Date()).catch(error => error);
  assert.ok(workflowError instanceof SwellError);
  assert.equal(workflowError.status, 400);
  assert.equal(workflowError.code, 'workflow_params_unserializable');
  assert.equal(workflowError.body.error.code, workflowError.code);
  assert.equal(calls, 0);
});

test('settings, workflow JSON safety and transaction retries are opt-in and bounded', async () => {
  const api = backend(); const seen = [];
  globalThis.fetch = async (url, options) => { seen.push([url, options]); return Response.json({ success: true }); };
  await assert.rejects(api.settings(), /appId/);
  await api.settings('app'); await new SwellBackendAPI({ ...credentials, appId: 'app' }).settings();
  assert.ok(seen.every(([url]) => url.endsWith('/settings/app')));
  await api.settings('some/app ?#');
  assert.equal(seen.at(-1)[0], 'https://api.example.test/settings/some%2Fapp%20%3F%23');
  await api.workflows.create('sync');
  assert.deepEqual(JSON.parse(seen.at(-1)[1].body), { workflow_name: 'sync' });
  const nonEnumerable = [1]; Object.defineProperty(nonEnumerable, '0', { enumerable: false });
  await api.workflows.create('sync', nonEnumerable);
  await api.workflows.create('sync', { values: [null, 2, false], nested: { ok: true } });
  assert.deepEqual(JSON.parse(seen.at(-1)[1].body), { workflow_name: 'sync', params: { values: [null, 2, false], nested: { ok: true } } });
  const cycle = {}; cycle.self = cycle;
  const sparse = new Array(2); const symbol = { [Symbol()]: true };
  for (const invalid of [cycle, sparse, symbol, NaN, Infinity, () => {}, new Date(), { missing: undefined }, 1n]) await assert.rejects(api.workflows.create('sync', invalid), error => error.code === 'workflow_params_unserializable');
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ error: { code: 'transaction_conflict' } }, { status: 409 }); };
  await assert.rejects(api.transaction([])); assert.equal(calls, 1);
  calls = 0; await assert.rejects(api.transaction([], { retry: { limit: 2, base: 0, jitter: false } })); assert.equal(calls, 3);
  calls = 0; await assert.rejects(api.post('/:transaction', [])); assert.equal(calls, 1);
  for (const code of ['transaction_throttled', 'transaction_timeout']) {
    calls = 0; globalThis.fetch = async () => { calls++; return calls === 1 ? Response.json({ error: { code } }, { status: 409 }) : Response.json([]); };
    if (code === 'transaction_throttled') { assert.deepEqual(await api.transaction([], { retry: { base: 0 } }), []); assert.equal(calls, 2); }
    else { await assert.rejects(api.transaction([], { retry: true })); assert.equal(calls, 1); }
  }
});

test('workflow parameter size includes UTF-8 bytes and JSON syntax at the exact limit', async () => {
  const api = backend(); const seen = [];
  globalThis.fetch = async (url, options) => { seen.push(JSON.parse(options.body)); return Response.json({ id: 'workflow' }); };
  const params = 'é'.repeat(65535); // 131070 UTF-8 bytes plus two JSON quotes = 128 KiB.
  assert.deepEqual(await api.workflows.create('sync', params), { id: 'workflow' });
  assert.deepEqual(seen, [{ workflow_name: 'sync', params }]);
  await assert.rejects(api.workflows.create('sync', `${params}a`), error => error instanceof SwellError
    && error.status === 400 && error.code === 'workflow_params_too_large');
  assert.equal(seen.length, 1);
});

test('functions.call invokes a private function through $call and unwraps its envelope', async () => {
  const api = backend(); const appId = 'multiseller'; const seen = [];
  let envelope = { status: 200, response: { ok: true }, headers: { 'x-custom': '1' } };
  globalThis.fetch = async (url, options) => { seen.push([url, options]); return Response.json(envelope); };
  assert.deepEqual(await api.functions.call(appId, 'returns-add-item', { id: 1 }), { ok: true });
  assert.equal(seen[0][0], `https://api.example.test/:functions/app.${appId}.returns-add-item`);
  assert.equal(seen[0][1].method, 'PUT');
  assert.deepEqual(JSON.parse(seen[0][1].body), { $call: { data: { id: 1 }, method: 'post' } });
  await api.functions.call(appId, 'returns-add-item');
  assert.deepEqual(JSON.parse(seen[1][1].body), { $call: { data: {}, method: 'post' } });
  await api.functions.call(appId, 'report', { month: 9, final: true }, { method: 'get' });
  assert.deepEqual(JSON.parse(seen[2][1].body), { $call: { data: { month: 9, final: true }, method: 'get' } });
  envelope = { status: 400, response: { error: 'Invalid payload' }, headers: {} };
  await assert.rejects(api.functions.call(appId, 'returns-add-item'), error => error instanceof SwellError
    && error.status === 400 && error.message === 'Invalid payload' && error.body.error === 'Invalid payload');
  envelope = { error: 'Resource not found', code: 'notfound' };
  await assert.rejects(api.functions.call(appId, 'missing'), error => error.status === 500 && error.code === 'notfound' && error.message === 'Resource not found');
  globalThis.fetch = async () => new Response('');
  await assert.rejects(api.functions.call(appId, 'missing'), error => error.status === 404);
  globalThis.fetch = () => assert.fail('unexpected fetch');
  for (const [id, name] of [['', 'x'], [undefined, 'x'], [appId, ''], [appId, undefined]]) await assert.rejects(api.functions.call(id, name));
  for (const [data, options] of [[{}, { method: 'patch' }], [{}, { method: 'GET' }], [{ where: { id: 1 } }, { method: 'get' }], [{ id: null }, { method: 'get' }]]) await assert.rejects(api.functions.call(appId, 'report', data, options));
});

test('cookie adapter retains decoded values, native defaults, custom attributes and successful writes', () => {
  const writes = [];
  const values = new Map();
  const client = createStorefrontClient(config, { cookies: { get: name => values.get(name), set: (...args) => { values.set(args[0], args[1]); writes.push(args); } } });
  client.setCookie('swell-session', 'decoded %=;値');
  assert.equal(client.getCookie('swell-session'), 'decoded %=;値');
  assert.deepEqual(writes[0], ['swell-session', 'decoded %=;値', { path: '/', maxAge: 604800, sameSite: 'lax' }]);
  const expires = new Date();
  client.setCookie('swell-locale', 'fr', { 'max-age': 1, samesite: 'strict', httponly: true, secure: true, domain: 'example.test', expires, partitioned: true });
  assert.deepEqual(writes[1][2], { path: '/', maxAge: 1, sameSite: 'strict', httpOnly: true, secure: true, domain: 'example.test', expires, partitioned: true });
  const failure = new Error('headers sent');
  const broken = createStorefrontClient(config, { cookies: { get: () => 'old', set: () => { throw failure; } } });
  assert.throws(() => broken.setCookie('swell-session', 'new'), error => error === failure);
  assert.equal(broken.getCookie('swell-session'), 'old');
});

test('custom cookie policy replaces native defaults and adapter state remains authoritative', () => {
  const values = new Map([['swell-session', 'old']]);
  const writes = [];
  const client = createStorefrontClient(config, {
    cookieOptions: {},
    cookies: { get: name => values.get(name), set: (...args) => { values.set(args[0], args[1]); writes.push(args); } },
  });
  client.session.setCookie('new');
  assert.deepEqual(writes[0], ['swell-session', 'new', {}]);
  assert.equal(client.session.getCookie(), 'new');
  // Framework writes/deletes must not be hidden by an SDK-local cookie cache.
  values.set('swell-session', 'external');
  assert.equal(client.session.getCookie(), 'external');
  values.delete('swell-session');
  assert.equal(client.session.getCookie(), undefined);
  client.setCookie('swell-locale', 'fr', { 'max-age': 10, samesite: 'strict' });
  assert.deepEqual(writes[1][2], { maxAge: 10, sameSite: 'strict' });
});

test('skipped writes preserve the adapter session, including GET rotation', async () => {
  const client = createStorefrontClient(config, { cookies: { get: () => 'old', set() {} } });
  client.setCookie('swell-session', 'skipped');
  assert.equal(client.session.getCookie(), 'old');
  globalThis.fetch = async (_url, { headers }) => {
    assert.equal(headers['X-Session'], 'old');
    return Response.json({ id: 'cart' }, { headers: { 'X-Session': 'rotated' } });
  };
  assert.deepEqual(await client.get('/cart'), { id: 'cart' });
  assert.equal(client.session.getCookie(), 'old');
});

test('GET session changes throw on read-only SSR while unchanged sessions do not write', async () => {
  const client = createStorefrontClient(config, { cookies: { get: name => name === 'swell-session' ? 'old' : undefined } });
  globalThis.fetch = async () => Response.json({}, { headers: { 'X-Session': 'old' } });
  await client.get('/products');
  globalThis.fetch = async () => Response.json({}, { headers: { 'X-Session': 'new' } });
  await assert.rejects(client.get('/products'), /read-only/);
});

test('concurrent stores, sessions, locales and currencies remain isolated', async () => {
  const clients = ['one', 'two'].map(store => {
    const values = new Map();
    return createStorefrontClient({ storeId: store, publicKey: `pk_${store}` }, { cookies: { get: name => values.get(name) ?? `${store}:${name}`, set: (name, value) => { values.set(name, value); } } });
  });
  globalThis.fetch = async (url, { headers }) => {
    await new Promise(resolve => setTimeout(resolve, url.includes('one') ? 10 : 1));
    return Response.json({ url, headers }, { headers: { 'X-Session': `${url}:updated` } });
  };
  const results = await Promise.all(clients.map(client => client.get('/products')));
  for (const [index, store] of ['one', 'two'].entries()) {
    assert.equal(results[index].headers['X-Session'], `${store}:swell-session`);
    assert.equal(results[index].headers['X-Locale'], `${store}:swell-locale`);
    assert.equal(results[index].headers['X-Currency'], `${store}:swell-currency`);
    assert.equal(results[index].headers.Authorization, `Basic ${Buffer.from(`pk_${store}`).toString('base64')}`);
    assert.ok(clients[index].getCookie('swell-session').includes(`${store}.swell.store`));
  }
});

test('native request replacement intercepts generic, product, cart and settings calls and preserves errors/options', async () => {
  const client = createStorefrontClient(config, { cookies: { get() {} } });
  const calls = []; const sentinel = new Error('transport');
  client.request = async (...args) => { calls.push(args); return { results: [], store: { name: 'Test' } }; };
  await client.get('/custom', { limit: 1 }); await client.post('/custom', {}); await client.products.list(); await client.cart.get(); await client.settings.get();
  client.request = async (...args) => { calls.push(args); return { settings: { store: { locale: 'en' } }, menus: [], payments: {}, subscriptions: {}, session: {} }; };
  await client.settings.load();
  assert.ok(calls.some(args => args[1] === '/settings/all'));
  assert.ok(calls.some(args => args[1] === '/products')); assert.ok(calls.some(args => args[1] === '/settings')); assert.ok(calls.some(args => args[1] === '/cart'));
  await client.request('get', '/custom', 'id', { field: 1 }, { force: true });
  assert.deepEqual(calls.at(-1), ['get', '/custom', 'id', { field: 1 }, { force: true }]);
  client.request = async () => { throw sentinel; };
  await assert.rejects(client.products.list(), error => error === sentinel);
});

test('storefront validates configuration and retains explicit defaults', () => {
  for (const value of [{}, { ...config, url: '' }, { ...config, vaultUrl: 'invalid' }, { ...config, timeout: NaN }, { ...config, headers: { x: 1 } }, { ...config, locale: 1 }, { ...config, getCart: () => {} }]) assert.throws(() => createStorefrontClient(value, { cookies: { get() {} } }));
  assert.throws(() => createStorefrontClient(config, { cookies: {} }));
  assert.ok(createStorefrontClient(config, { cookies: { get() {} } }));
});

test('a themes-style request wrapper can delegate all five arguments, skip fetch on cache hit and retain errors', async () => {
  let fetches = 0;
  globalThis.fetch = async (url, options) => {
    fetches++;
    assert.ok(url.includes('/api/custom/id'));
    assert.equal(options.headers['X-Custom'], 'forwarded');
    return Response.json({ value: 42 });
  };
  const client = createStorefrontClient(config, { cookies: { get() {} } });
  const original = client.request;
  let cached;
  client.request = async (...args) => {
    if (cached && !args[4]?.force) return cached;
    return cached = await original(...args);
  };
  const args = ['get', '/custom', 'id', { limit: 1 }, { headers: { 'X-Custom': 'forwarded' } }];
  assert.deepEqual(await client.request(...args), { value: 42 });
  assert.deepEqual(await client.request(...args), { value: 42 }); assert.equal(fetches, 1);
  await client.request(...args.slice(0, 4), { ...args[4], force: true }); assert.equal(fetches, 2);
  const failure = new TypeError('network'); globalThis.fetch = async () => { throw failure; };
  await assert.rejects(client.request(...args.slice(0, 4), { force: true }), error => error === failure);
});
