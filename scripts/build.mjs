import { readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
const file = new URL('../dist/version.js', import.meta.url);
await writeFile(file, (await readFile(file, 'utf8')).replace('__SDK_VERSION__', version));

// CommonJS consumers need CJS declarations even though Node loads the same ESM runtime.
for (const name of await readdir('dist')) {
  if (name.endsWith('.d.ts')) {
    const source = (await readFile(`dist/${name}`, 'utf8')).replace('__SDK_VERSION__', version);
    await writeFile(`dist/${name}`, source);
    await writeFile(`dist/${name.replace('.d.ts', '.d.cts')}`, source.replaceAll('.js\'', '.cjs\''));
  }
}
