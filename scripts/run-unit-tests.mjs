/**
 * Runs vitest under Electron's Node.
 *
 * better-sqlite3 is compiled against Electron's ABI, so the unit tests can't run on plain
 * Node. The path to the Electron binary differs per platform (Electron.app/... on macOS,
 * a bare executable elsewhere), so it's resolved from the `electron` package rather than
 * hardcoded — a hardcoded macOS path meant these tests could never run in CI.
 *
 * Invoked instead of a .bin shim because Node 24 broke those on some setups.
 *
 *   node scripts/run-unit-tests.mjs run          # single pass
 *   node scripts/run-unit-tests.mjs              # watch mode
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The `electron` package's main export is the path to its binary, per platform.
const electronBinary = require('electron');
if (typeof electronBinary !== 'string' || !existsSync(electronBinary)) {
  console.error('Could not resolve the Electron binary — try `npm ci`.');
  process.exit(1);
}

// vitest's exports map doesn't expose this entry point, so reach for the file directly.
const vitestEntry = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
if (!existsSync(vitestEntry)) {
  console.error(`vitest not found at ${vitestEntry} — try \`npm ci\`.`);
  process.exit(1);
}

const result = spawnSync(electronBinary, [vitestEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

process.exit(result.status ?? 1);
