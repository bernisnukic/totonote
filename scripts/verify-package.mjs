#!/usr/bin/env node
// scripts/verify-package.mjs
//
// Asserts that the packaged app contains the better-sqlite3 native binding in
// app.asar.unpacked. Runs automatically after `npm run make` via the `postmake`
// lifecycle script in package.json — so every local make AND every CI build
// fails fast if native modules ever stop being packaged correctly.
//
// Why this exists: the Forge Vite plugin builds only .vite/ into the staged
// app dir — node_modules is dropped — so external native deps must be
// explicitly copied in (see packageAfterCopy in forge.config.ts) and unpacked
// from the asar (asar.unpack matching .node files). If either step regresses,
// every mac launch crashes with "Cannot find module 'better-sqlite3'". This
// script catches that the moment it happens, instead of at user-install time.

import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

function fail(msg) {
  console.error(`✗ verify-package: ${msg}`);
  process.exit(1);
}

function findPackagedResources() {
  if (!existsSync('out')) {
    console.error('out/ not found — run `npm run make` first');
    process.exit(2);
  }
  for (const e of readdirSync('out')) {
    const p = join('out', e);
    if (!statSync(p).isDirectory()) continue;
    if (e.includes('-darwin-')) {
      const app = readdirSync(p).find((f) => f.endsWith('.app'));
      if (app) return join(p, app, 'Contents', 'Resources');
    } else if (e.includes('-linux-') || e.includes('-win32-')) {
      const r = join(p, 'resources');
      if (existsSync(r)) return r;
    }
  }
  console.error('Could not find a packaged app under out/');
  process.exit(2);
}

const res = findPackagedResources();
console.log(`verify-package: checking ${res}`);

const unpacked = join(res, 'app.asar.unpacked');
if (!existsSync(unpacked)) {
  fail(`Missing app.asar.unpacked/ — no native modules were unpacked. The app will crash at startup with "Cannot find module 'better-sqlite3'".`);
}

const sqliteDir = join(unpacked, 'node_modules', 'better-sqlite3');
if (!existsSync(sqliteDir)) {
  fail(`Missing ${sqliteDir} — better-sqlite3 wasn't included in the package.`);
}

const buildRel = join(sqliteDir, 'build', 'Release');
if (!existsSync(buildRel)) {
  fail(`Missing ${buildRel} — better-sqlite3 has no compiled native binding directory.`);
}

const nodeFiles = readdirSync(buildRel).filter((f) => f.endsWith('.node'));
if (nodeFiles.length === 0) {
  fail(`No .node file in ${buildRel} — the native binding is missing.`);
}

console.log(`✓ verify-package: better-sqlite3 native binding present (${nodeFiles[0]})`);
