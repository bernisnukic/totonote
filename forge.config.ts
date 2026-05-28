import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { execFileSync } from 'child_process';
import { readdirSync, mkdirSync, cpSync, readFileSync, existsSync } from 'fs';
import { builtinModules } from 'module';
import path from 'path';

// Walk package.json dependencies starting from `seeds` and return every
// package name in the closure (the seeds plus everything they require at
// runtime). Used by packageAfterCopy to ship the full transitive tree —
// otherwise better-sqlite3 launches but crashes on `require('bindings')`.
function collectRuntimeDeps(seeds: string[], nodeModulesRoot: string): Set<string> {
  const all = new Set<string>();
  const queue = [...seeds];
  while (queue.length > 0) {
    const dep = queue.shift()!;
    if (all.has(dep)) continue;
    all.add(dep);
    const pkgJsonPath = path.join(nodeModulesRoot, dep, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    for (const child of Object.keys(pkg.dependencies ?? {})) {
      queue.push(child);
    }
  }
  return all;
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Native .node files can't be loaded from inside an asar — unpack them.
      unpack: '**/*.node',
    },
    // Linux .deb/.rpm makers look for a lowercase binary named after the package
    // "name" (totonote); macOS/Windows keep the "TotoNote" display name.
    executableName: process.platform === 'linux' ? 'totonote' : 'TotoNote',
    // Drizzle's migrator reads SQL files from disk; ship them next to the app
    // so `process.resourcesPath/migrations/` resolves in packaged builds.
    extraResource: ['./src/main/db/migrations'],
  },
  rebuildConfig: {},
  hooks: {
    // The Forge Vite plugin only places .vite/ into the staged app dir —
    // node_modules is NOT carried over, so anything the main bundle
    // require()s at runtime must be copied in by hand. Vite/Rollup leaves
    // CommonJS require() calls as-is in the output (no commonjs plugin), so
    // every main-process npm dep behaves like an external. List them here.
    //   - better-sqlite3: native module; .node binding goes to app.asar.unpacked/
    //     via the asar.unpack glob.
    //   - electron-squirrel-startup: pure JS, but the bare require() in
    //     src/main/index.ts is left at runtime — missing it crashes mac
    //     launches and breaks Windows Squirrel install events.
    packageAfterCopy: async (_config, buildPath) => {
      const mainProcessDeps = ['better-sqlite3', 'electron-squirrel-startup'];

      // Defensive scan: every external require() in the built main bundle
      // MUST be in mainProcessDeps, or the packaged app will crash at launch.
      // This catches the class of bug v1.0.1/v1.0.3 shipped with — easy to
      // forget when adding a new main-process dep.
      const bundlePath = path.join(buildPath, '.vite', 'build', 'index.js');
      const bundle = readFileSync(bundlePath, 'utf-8');
      const externals = new Set<string>();
      for (const m of bundle.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/')) continue;
        if (spec.startsWith('node:')) continue;
        if (spec === 'electron') continue;
        if (builtinModules.includes(spec)) continue;
        // Resolve scoped packages and subpaths to their root package name.
        const rootName = spec.startsWith('@')
          ? spec.split('/').slice(0, 2).join('/')
          : spec.split('/')[0];
        externals.add(rootName);
      }
      const missing = [...externals].filter(d => !mainProcessDeps.includes(d));
      if (missing.length > 0) {
        throw new Error(
          `[forge:packageAfterCopy] Main bundle require()s modules missing from mainProcessDeps: ${missing.join(', ')}\n` +
          `  Add them to mainProcessDeps in forge.config.ts so they're copied into the package, or the app crashes at launch with "Cannot find module ...".`
        );
      }

      const srcRoot = path.join(process.cwd(), 'node_modules');
      const dstRoot = path.join(buildPath, 'node_modules');
      mkdirSync(dstRoot, { recursive: true });
      const allDeps = collectRuntimeDeps(mainProcessDeps, srcRoot);
      for (const dep of allDeps) {
        const src = path.join(srcRoot, dep);
        if (!existsSync(src)) continue;
        cpSync(src, path.join(dstRoot, dep), { recursive: true });
      }
    },
    // Ad-hoc re-sign the macOS app after packaging so downloaded builds aren't
    // flagged "damaged". Packaging modifies the bundle (asar, renamed binary),
    // invalidating Electron's original signature; on Apple Silicon an invalid
    // signature is rejected outright. `codesign --deep -s -` lays down a fresh
    // ad-hoc signature over the final bundle. (Forge's osxSign with identity '-'
    // does NOT actually sign here — verified locally — so we re-sign explicitly.)
    // NOT a Developer ID signature: users still clear the first-launch
    // "unidentified developer" prompt (right-click → Open).
    postPackage: async (_config, { platform, outputPaths }) => {
      if (platform !== 'darwin') return;
      for (const outputPath of outputPaths) {
        const appDir = readdirSync(outputPath).find((f) => f.endsWith('.app'));
        if (appDir) {
          execFileSync(
            'codesign',
            ['--force', '--deep', '--sign', '-', path.join(outputPath, appDir)],
            { stdio: 'inherit' },
          );
        }
      }
    },
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      // Off: nothing is stored in cookies that needs keychain encryption, and
      // turning this on triggers a macOS keychain access prompt on every launch.
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
