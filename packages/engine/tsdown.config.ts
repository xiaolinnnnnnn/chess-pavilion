import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    outDir: 'dist',
    format: ['cjs', 'esm'],
    dts: true,
    target: 'node18',
    sourcemap: true,
    clean: true,
  },
  {
    entry: { client: 'src/client.ts' },
    outDir: 'dist',
    format: ['cjs', 'esm', 'iife'],
    globalName: 'YigeClient',
    dts: true,
    target: 'es2018',
    minify: true,
    sourcemap: true,
    clean: false,
  },
]);
