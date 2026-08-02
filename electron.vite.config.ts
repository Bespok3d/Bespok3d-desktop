// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createRequire } from 'node:module'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const { version } = require('./package.json')

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
    },
    resolve: {
      alias: {
        '@adapter-sdk': resolve(__dirname, 'src/main/adapter-loader/index.ts'),
        '@adapters': resolve(__dirname, '../adapters'),
        '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
      },
    },
  },
  preload: {},
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
