import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const output = resolve('.verification');
await mkdir(output, { recursive: true });
const packed = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
for (const name of ['core-worker.mjs']) {
  await writeFile(join(packed.fixture, name), await readFile(join('test/fixtures', name)));
}
const options = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'browser'], write: false, metafile: true };
const core = await build({ ...options, entryPoints: [join(packed.fixture, 'core-worker.mjs')] });
await writeFile(join(output, 'core-worker.mjs'), core.outputFiles[0].contents);
const outbound = async request => {
  const url = new URL(request.url);
  if (url.pathname === '/admin/api/session') return Response.json({ client_id: request.headers.get('X-Session'), user_id: 'staff' });
  if (url.pathname === '/redirect') return new Response('', { status: 302, headers: { Location: 'https://must-not-follow.test' } });
  assert.notEqual(url.hostname, 'must-not-follow.test');
  if (url.hostname === 'backend.test') return Response.json({ auth: request.headers.get('Authorization'), query: url.search });
  const id = url.hostname.split('.')[0];
  return Response.json({ results: [], id, session: request.headers.get('X-Session') }, { headers: { 'X-Session': `${id}:updated` } });
};
const flags = ['no_nodejs_compat', 'no_nodejs_compat_v2'];
const mf = new Miniflare(convertV4MiniflareOptions({ workers: [
  { name: 'core', modules: true, script: core.outputFiles[0].text, compatibilityDate: '2026-09-11', compatibilityFlags: flags, outboundService: outbound },
] }));
try {
  const coreWorker = await mf.getWorker('core');
  const results = await Promise.all(['one', 'two'].map(async id => (await coreWorker.fetch(`https://app.test/?id=${id}`)).json()));
  for (const result of results) {
    assert.equal(result.storefront.id, result.id);
    assert.equal(result.storefront.session, `${result.id}:swell-session`);
    assert.equal(result.session, `${result.id}:updated`);
    assert.equal(result.backend.auth, `Basic ${Buffer.from(`${result.id}:token-${result.id}`).toString('base64')}`);
    assert.equal(result.backend.query, '?null');
    assert.deepEqual(result.staff, { userId: 'staff', storeId: result.id });
    assert.deepEqual(result.writes[0], ['swell-session', `${result.id}:updated`, { path: '/', maxAge: 604800, sameSite: 'lax' }]);
    assert.equal(result.readOnly, true); assert.equal(result.redirect, true);
  }
  await writeFile(join(output, 'workerd.json'), JSON.stringify({ miniflare: JSON.parse(await readFile('node_modules/miniflare/package.json')).version, coreFlags: flags, results }, null, 2));
  console.log('Packed SDK: real workerd core isolation without Node compatibility passed');
} finally { await mf.dispose(); }
