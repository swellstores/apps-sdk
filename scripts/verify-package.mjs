import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const root = process.cwd();
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const output = resolve('../sdk-experiment-artifacts/session-2-client-scope');
process.env.npm_config_cache = resolve('../sdk-experiment-artifacts/npm-cache');
await mkdir(output, { recursive: true });
const packed = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], { encoding: 'utf8' }))[0];
assert.ok(!packed.files.some(({ path }) => /(?:^|\/)(?:functions|function-types)(?:\.|\/)/.test(path)), 'Function runtime leaked into packed files');
assert.ok(!packed.files.some(({ path }) => path.startsWith('test/') || path.startsWith('experiments/')), 'Experimental code leaked into packed files');
const fixture = await mkdtemp(join(tmpdir(), 'apps-sdk-packed-'));
await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
  '@swell/apps-sdk': `file:${join(output, packed.filename)}`,
  'swell-js': pkg.devDependencies['swell-js'],
} }));
execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'], { cwd: fixture, stdio: 'inherit' });
const source = await readFile('test/fixtures/consumer.ts', 'utf8');
for (const ext of ['mts', 'cts', 'ts']) await writeFile(join(fixture, `consumer.${ext}`), source);
for (const [mode, file] of [['NodeNext', 'consumer.mts'], ['NodeNext', 'consumer.cts'], ['Bundler', 'consumer.ts']]) {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', 'false', '--target', 'ES2022', '--module', mode === 'Bundler' ? 'ESNext' : mode, '--moduleResolution', mode, file], { cwd: fixture, stdio: 'inherit' });
}
await writeFile(join(fixture, 'runtime.cjs'), `const assert = require('node:assert/strict');
const root = require('@swell/apps-sdk');
const storefront = require('@swell/apps-sdk/storefront');
assert.deepEqual(Object.keys(root).sort(), ['SwellBackendAPI', 'SwellError', 'getStorefrontConfig', 'parseSwellHeaders', 'requireStaff'].sort());
assert.deepEqual(Object.keys(storefront), ['createStorefrontClient']);
assert.equal(typeof storefront.createStorefrontClient, 'function');
assert.throws(() => require('@swell/apps-sdk/functions'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
Promise.all(['@swell/apps-sdk', '@swell/apps-sdk/storefront'].map(s => import(s))).then(async ([esm, sf]) => {
 await assert.rejects(import('@swell/apps-sdk/functions'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
 assert.equal(root.SwellError, esm.SwellError);
 assert.equal(sf.createStorefrontClient, storefront.createStorefrontClient);
 const client = storefront.createStorefrontClient({ storeId: 's', publicKey: 'k' }, { cookies: { get() {} } });
 assert.equal(typeof client.products.list, 'function'); console.log(process.version, 'packed ESM/CJS identity and subpaths pass');
});`);
const nodes = process.env.SDK_TEST_NODES ? process.env.SDK_TEST_NODES.split(':') : [process.execPath];
for (const node of nodes) execFileSync(node, ['runtime.cjs'], { cwd: fixture, stdio: 'inherit' });
await writeFile(join(output, 'package.json'), JSON.stringify({ packed, fixture, nodes, types: ['NodeNext ESM', 'NodeNext CJS', 'Bundler'], implementation: 'single ESM' }, null, 2));
console.log('Packed artifact verified:', join(output, packed.filename));
