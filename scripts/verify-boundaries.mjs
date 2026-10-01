import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const output = resolve('.verification');
await mkdir(output, { recursive: true });
const { fixture } = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'));
const sdk = join(fixture, 'node_modules/@swell/apps-sdk');
const fixtures = {
  empty: `export default {fetch(){return Response.json({ok:true})}}`,
  config: `import {getStorefrontConfig} from '@swell/apps-sdk'; export default {fetch(r){return Response.json(getStorefrontConfig(r.headers))}}`,
  backend: `import {SwellBackendAPI} from '@swell/apps-sdk'; export default {async fetch(r){return Response.json(await new SwellBackendAPI({headers:r.headers}).get('/products'))}}`,
  verified: `import {verifySwellContext,getStorefrontConfig,requireStaff} from '@swell/apps-sdk'; export default {async fetch(r,env){const context=await verifySwellContext(r.headers,{env});requireStaff(context);return Response.json(getStorefrontConfig(context))}}`,
  storefront: `import {createStorefrontClient} from '@swell/apps-sdk/storefront'; export default {async fetch(){return Response.json(await createStorefrontClient({storeId:'s',publicKey:'k'},{cookies:{get(){}}}).products.list())}}`,
};
const reports = {};
const forbidden = /(?:node:|themes-sdk|liquid|cache-manager|keyv|lodash(?:-es)?(?:\/|$))/i;
const baseOptions = { bundle: true, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'browser'], minify: true, metafile: true, write: false, logLevel: 'silent' };
const profiles = {
  browser: {},
  server: { platform: 'neutral', mainFields: ['module', 'main'], conditions: ['workerd', 'worker', 'module'] },
};
for (const [profile, resolution] of Object.entries(profiles)) {
  for (const [name, contents] of Object.entries(fixtures)) {
    const label = profile === 'browser' ? name : `${name}-server`;
    const options = { ...baseOptions, ...resolution, stdin: { contents, resolveDir: fixture, sourcefile: `${name}.mjs` } };
    const result = await build(options);
    const inputs = Object.keys(result.metafile.inputs);
    assert.ok(!inputs.some(path => forbidden.test(path)), inputs.join('\n'));
    if (name !== 'storefront') assert.ok(!inputs.some(path => /swell-js|storefront\.js/.test(path)), inputs.join('\n'));
    assert.ok(!inputs.some(path => /(?:functions|function-types)\.js/.test(path)));
    assert.ok(!inputs.some(path => /\.cjs$/.test(path)), 'Worker selected CJS');
    assert.ok(Object.values(result.metafile.outputs).every(output => output.imports.length === 0), 'SDK Worker bundle has external imports');
    const bytes = result.outputFiles[0].contents;
    if (name !== 'verified') assert.ok(!/swell_jwks_unavailable|invalid_swell_context|subtle\.verify/.test(result.outputFiles[0].text), 'Verifier leaked into transport-only bundle');
    // Exact same input, resolving directly to ESM as the no-require baseline.
    const baseline = await build({ ...options, alias: {
      '@swell/apps-sdk/storefront': join(sdk, 'dist/storefront.js'),
      '@swell/apps-sdk': join(sdk, 'dist/index.js'),
    } });
    assert.equal(bytes.length, baseline.outputFiles[0].contents.length);
    assert.equal(gzipSync(bytes).length, gzipSync(baseline.outputFiles[0].contents).length);
    reports[label] = { raw: bytes.length, gzip: gzipSync(bytes).length, esmOnlyRaw: baseline.outputFiles[0].contents.length, inputs };
    await writeFile(join(output, `${label}.mjs`), bytes);
    await writeFile(join(output, `${label}.graph.json`), JSON.stringify(result.metafile, null, 2));
  }
}
for (const [entry, symbol] of [['', 'SwellBackendAPI'], ['/storefront', 'createStorefrontClient']]) {
  await assert.rejects(build({ ...baseOptions, conditions: ['browser'], stdin: { contents: `import {${symbol}} from '@swell/apps-sdk${entry}'; console.log(${symbol});`, resolveDir: fixture } }), /No matching export/);
  const result = await build({ ...baseOptions, conditions: ['browser'], stdin: { contents: `import '@swell/apps-sdk${entry}';`, resolveDir: fixture } });
  assert.match(result.outputFiles[0].text, /server-only/);
  assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e', result.outputFiles[0].text], { stdio: 'pipe', cwd: fixture }), /server-only/);
  const guardBuild = await build({ ...baseOptions, conditions: ['node'], stdin: { contents: `import '@swell/apps-sdk${entry}';`, resolveDir: fixture } });
  assert.match(guardBuild.outputFiles[0].text, /server-only/);
  // Node resolution intentionally bypasses browser conditions: DOM guard must still refuse.
  assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e', `globalThis.document={}; await import('@swell/apps-sdk${entry}');`], { stdio: 'pipe', cwd: fixture }), /server-only/);
}
await assert.rejects(build({ ...baseOptions, stdin: { contents: `import '@swell/apps-sdk/functions';`, resolveDir: fixture } }), /not exported|Could not resolve/);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './storefront']);
assert.deepEqual(pkg.dependencies ?? {}, {});
assert.deepEqual(pkg.peerDependencies, { 'swell-js': '>=5.9.1' });
await writeFile(join(output, 'bundles.json'), JSON.stringify(reports, null, 2));
console.table(Object.fromEntries(Object.entries(reports).map(([name, { raw, gzip }]) => [name, { raw, gzip }])));
console.log('ESM graphs, ESM-only size parity and every browser refusal passed');
