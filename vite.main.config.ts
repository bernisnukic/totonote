import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      // tesseract.js loads a WASM core and worker scripts from its own package at
      // runtime, so it has to stay an external require rather than being inlined.
      external: ['better-sqlite3', 'tesseract.js'],
      // One file for the main process. The lazy import of tesseract would otherwise be
      // split into a side chunk that has to be copied intact into the package — an easy
      // thing to lose, and it only fails at runtime.
      output: { inlineDynamicImports: true },
    },
  },
});
