/**
 * Builds main + preload for E2E testing.
 * Produces .vite/build/index.js and .vite/build/preload.js
 * with MAIN_WINDOW_VITE_DEV_SERVER_URL pointing to the Vite dev server.
 */
import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const VITE_PORT = process.env.VITE_PORT || '5173';

// Build main process
await build({
  root,
  configFile: false,
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(root, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'crypto',
        'path',
        'fs',
        'url',
        'electron-squirrel-startup',
      ],
    },
    minify: false,
    sourcemap: false,
  },
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify(`http://localhost:${VITE_PORT}`),
    MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
  },
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'src/shared'),
    },
  },
});

// Build preload
await build({
  root,
  configFile: false,
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: path.resolve(root, 'src/preload/preload.ts'),
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
    minify: false,
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(root, 'src/shared'),
    },
  },
});

console.log('Build complete: .vite/build/index.js + preload.js');
