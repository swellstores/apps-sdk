import { build } from './lib/build.mjs';

await build(
  ['esm', 'cjs', 'iife'],
  {
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.$formatExtension',
    bundle: true,
    sourcemap: true,
    minify: true,
    platform: 'node',
    packages: 'external',
    target: ['esnext'],
    loader: { '.svg': 'text' },
  },
  process.argv[2] === 'watch',
);
