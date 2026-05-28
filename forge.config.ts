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
import { readdirSync, mkdirSync, cpSync } from 'fs';
import path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Native .node files can't be loaded from inside an asar — unpack them.
      unpack: '**/*.node',
    },
    // Linux .deb/.rpm makers look for a lowercase binary named after the package
    // "name" (totonote); macOS/Windows keep the "TotoNote" display name.
    executableName: process.platform === 'linux' ? 'totonote' : 'TotoNote',
  },
  rebuildConfig: {},
  hooks: {
    // The Forge Vite plugin only places .vite/ into the staged app dir —
    // node_modules is NOT carried over, so external native deps like
    // better-sqlite3 can't be resolved at runtime. Copy native deps here so
    // packaging includes them; the asar.unpack glob then puts their .node
    // files in app.asar.unpacked/.
    packageAfterCopy: async (_config, buildPath) => {
      const nativeDeps = ['better-sqlite3'];
      const srcRoot = path.join(process.cwd(), 'node_modules');
      const dstRoot = path.join(buildPath, 'node_modules');
      mkdirSync(dstRoot, { recursive: true });
      for (const dep of nativeDeps) {
        cpSync(path.join(srcRoot, dep), path.join(dstRoot, dep), { recursive: true });
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
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
