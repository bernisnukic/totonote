import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  // One retry on CI absorbs the occasional timing flake on a slow shared runner; locally a
  // failure should stay a failure so it gets looked at.
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --config vite.renderer.config.ts --port 5173 --strictPort',
    port: 5173,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
