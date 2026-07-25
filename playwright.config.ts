import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  // Each spec file launches its own app against its own throwaway database, so files are
  // independent even though tests within one are not. Running a few at a time cuts a
  // five-minute suite to roughly a third of that, and CI has the cores for it.
  fullyParallel: false,
  // One retry on CI absorbs the occasional timing flake on a slow shared runner; locally a
  // failure should stay a failure so it gets looked at.
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 3 : 2,
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
