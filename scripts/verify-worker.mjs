import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { createSigner } from '../test/helpers/context.mjs';
const signer = createSigner('https://keys.test');
const localSigner = createSigner('http://localhost:4001');
const output = resolve('.verification');
await mkdir(output, { recursive: true });
const packed = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
for (const name of ['core-worker.mjs']) {
  await writeFile(join(packed.fixture, name), await readFile(join('test/fixtures', name)));
}
const options = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'browser'], write: false, metafile: true };
const outbound = async request => {
  const url = new URL(request.url);
  if (url.origin === 'https://keys.test') return Response.json({ keys: [signer.jwk] });
  if (url.pathname === '/redirect') return new Response('', { status: 302, headers: { Location: 'https://must-not-follow.test' } });
  assert.notEqual(url.hostname, 'must-not-follow.test');
  if (url.hostname === 'backend.test') return Response.json({ auth: request.headers.get('Authorization'), query: url.search });
  const id = url.hostname.split('.')[0];
  return Response.json({ results: [], id, session: request.headers.get('X-Session') }, { headers: { 'X-Session': `${id}:updated` } });
};
const flags = ['no_nodejs_compat', 'no_nodejs_compat_v2'];
const profiles = {
  browser: {},
  server: { platform: 'neutral', mainFields: ['module', 'main'], conditions: ['workerd', 'worker', 'module'] },
};
for (const [profile, resolution] of Object.entries(profiles)) {
  const core = await build({ ...options, ...resolution, entryPoints: [join(packed.fixture, 'core-worker.mjs')] });
  await writeFile(join(output, `core-worker-${profile}.mjs`), core.outputFiles[0].contents);
  const worker = { modules: true, script: core.outputFiles[0].text, compatibilityDate: '2026-09-11', outboundService: outbound };
  const bindings = { SWELL_HEADERS_JWKS_URL: 'https://keys.test/.well-known/jwks.json' };
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
    { ...worker, name: 'core', compatibilityFlags: flags, bindings },
    { ...worker, name: 'local', compatibilityFlags: flags, bindings: { ...bindings, SWELL_VERIFY_HEADERS: 'false' } },
    { ...worker, name: 'process-verified', compatibilityFlags: [], bindings: { ...bindings, PROCESS_ENV_TEST: 'true' } },
    { ...worker, name: 'process-disabled', compatibilityFlags: [], bindings: { ...bindings, PROCESS_ENV_TEST: 'true', SWELL_VERIFY_HEADERS: 'false' } },
  ] }));
  try {
    const coreWorker = await mf.getWorker('core');
    const results = await Promise.all(['one', 'two'].map(async id => (await coreWorker.fetch(`https://app.test/?id=${id}`, { headers: { 'Swell-Context': signer.token({ store_id: id, admin_url: `https://${id}.test` }) } })).json()));
    for (const result of results) {
      assert.ok(result.storefront, JSON.stringify(result));
      assert.equal(result.storefront.id, result.id);
      assert.equal(result.storefront.session, `${result.id}:swell-session`);
      assert.equal(result.session, `${result.id}:updated`);
      assert.equal(result.backend.auth, `Basic ${Buffer.from(`${result.id}:token-${result.id}`).toString('base64')}`);
      assert.equal(result.backend.query, '?null');
      assert.deepEqual(result.staff, { userId: 'staff', storeId: result.id });
      assert.deepEqual(result.writes[0], ['swell-session', `${result.id}:updated`, { path: '/', maxAge: 604800, sameSite: 'lax' }]);
      assert.equal(result.readOnly, true); assert.equal(result.redirect, true);
    }
    for (const token of ['', signer.token({ store_id: 'other' }), signer.token({ store_id: 'one', admin: null }), localSigner.token({ store_id: 'one' })]) {
      const rejected = await coreWorker.fetch('https://app.test/context?id=one', { headers: { 'Swell-Context': token } });
      assert.equal(rejected.status, 401);
    }
    for (const name of ['local', 'process-verified', 'process-disabled']) {
      const target = await mf.getWorker(name);
      const verify = name === 'process-verified';
      const token = (verify ? signer : localSigner).token({ store_id: 'one' });
      const response = await target.fetch('https://app.test/context?id=one', { headers: { 'Swell-Context': token } });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { staff: { userId: 'staff', storeId: 'one' }, signatureVerified: verify });
    }
    await writeFile(join(output, `workerd-${profile}.json`), JSON.stringify({ miniflare: JSON.parse(await readFile('node_modules/miniflare/package.json')).version, coreFlags: flags, results }, null, 2));
    console.log(`Packed SDK (${profile} resolution): real workerd core isolation without Node compatibility passed`);
  } finally { await mf.dispose(); }
}
