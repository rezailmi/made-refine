import { defineConfig } from 'tsup'
import type { Plugin } from 'esbuild'
import path from 'path'

function rawLoader(): Plugin {
  return {
    name: 'raw-loader',
    setup(build) {
      build.onResolve({ filter: /\?raw$/ }, (args) => ({
        path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      }))
    },
  }
}

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/utils.ts', 'src/preload.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: ['**/*', '!styles.css'],
    external: ['react', 'react-dom'],
    loader: { '.css': 'text' },
    esbuildPlugins: [rawLoader()],
  },
  {
    entry: { preload: 'src/preload.ts' },
    format: ['iife'],
    outDir: 'dist/preload',
    outExtension: () => ({ js: '.js' }),
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    platform: 'browser',
    globalName: 'DirectEditPreload',
  },
  {
    entry: { vite: 'vite/index.ts' },
    format: ['esm'],
    outDir: 'dist',
    outExtension: () => ({ js: '.mjs' }),
    dts: false,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ['vite'],
  },
  {
    entry: { babel: 'babel/index.cjs' },
    format: ['cjs'],
    outDir: 'dist',
    outExtension: () => ({ js: '.cjs' }),
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    platform: 'node',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs'],
    outDir: 'dist',
    outExtension: () => ({ js: '.cjs' }),
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    platform: 'node',
    target: 'node18',
    banner: { js: '#!/usr/bin/env node' },
    noExternal: ['commander', 'prompts', 'picocolors'],
  },
])
