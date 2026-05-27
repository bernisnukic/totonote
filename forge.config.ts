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
import { readdirSync } from 'fs';
import path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Linux .deb/.rpm makers look for a lowercase binary named after the package
    // "name" (totonote); macOS/Windows keep the "TotoNote" display name.
    executableName: process.platform === 'linux' ? 'totonote' : 'TotoNote',
  },
  rebuildConfig: {},
  hooks: {
    // Ad-hoc sign the macOS app so downloaded builds aren't flagged "damaged".
    // An unsigned/invalidated arm64 app is rejected outright by Gatekeeper; an
    // ad-hoc signature downgrades that to the normal "unidentified developer"
    // prompt users clear with right-click → Open (or `xattr -dr com.apple.quarantine`).
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
