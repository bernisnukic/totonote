import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
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
