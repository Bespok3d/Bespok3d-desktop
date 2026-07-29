// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { resolve } from 'path'
import { defineConfig } from 'vite'

// Ladle merges this on top of its own React-aware Vite setup. We only need the renderer's path
// aliases (mirrored from electron.vite.config.ts) so catalogued components resolve the same imports
// they do in the app. React/JSX + CSS handling come from Ladle itself.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, '../src/renderer/src'),
      '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
      '@plugins': resolve(__dirname, '../plugins'),
      '@adapters': resolve(__dirname, '../adapters'),
    },
  },
})
