// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRequire } from 'node:module'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { channelFor, versionForChannel, versionLabelError } from './scripts/channels.mjs'

const require = createRequire(import.meta.url)
const { version: packageVersion } = require('./package.json')
const buildFlavor = process.env.B3D_CHANNEL ?? 'development'
const channel = channelFor(buildFlavor)
const liveVersion = process.env.B3D_LIVE_VERSION ?? packageVersion
const version = process.env.B3D_VERSION ?? versionForChannel(buildFlavor, liveVersion)
const labelError = process.env.B3D_PUBLISHED_CUT === 'true' ? versionLabelError(buildFlavor, version) : null
if (labelError) throw new Error(labelError)

export default defineConfig({
  main: {
    // The project token travels in the build, not in the user's environment. A checkout whose shell
    // has no token builds an app that is inert rather than one that fails: the empty string is what
    // the gate reads on any machine but the release one. This is the write-only ingest token that
    // every install is meant to carry, NEVER the owner's `phx_` configuration key: that one can read
    // and rewrite the whole project, and anything baked into a build is readable by anyone who has
    // the build.
    define: {
      __ANALYTICS_PROJECT_TOKEN__: JSON.stringify(process.env.BESPOK3D_POSTHOG_PROJECT_TOKEN ?? ''),
      __B3D_CHANNEL__: JSON.stringify(channel.buildFlavor),
    },
    resolve: {
      alias: {
        '@adapter-sdk': resolve(__dirname, 'src/main/adapter-loader/index.ts'),
        '@adapters': resolve(__dirname, '../adapters'),
        '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
      },
    },
  },
  // The preload bundle reaches into `src/main/app-update/view.ts` for the update strategy it shows the
  // renderer, and that module reads the shared version comparator. Every bundle that can reach a shared
  // import needs the alias, not just the two that own the code.
  preload: {
    resolve: {
      alias: {
        '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
      },
    },
  },
  renderer: {
    define: { __APP_VERSION__: JSON.stringify(version) },
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@plugins': resolve(__dirname, '../plugins'),
        '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
      },
    },
    plugins: [react()],
  },
})
