// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // A test run is keyless by construction, so no test can reach the analytics host even by accident.
  define: { __APP_VERSION__: '"test"', __ANALYTICS_PROJECT_KEY__: '""' },
  // Plugin docs are imported as raw strings via import.meta.glob('**/doc/*.md', {query:'?raw'}). Mark
  // .md as an asset so Vite never runs JS import-analysis on it (which crashes the --changed run when
  // a catalog-importing test is in the changed set; the full run already tolerates it).
  assetsInclude: ['**/*.md'],
  resolve: {
    alias: {
      '@plugins': resolve(__dirname, '../plugins'),
      '@adapter-sdk': resolve(__dirname, 'src/main/adapter-loader/index.ts'),
      '@adapters': resolve(__dirname, '../adapters'),
      '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
    },
  },
  test: {
    environment: 'node',
    css: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', './tools/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      // The cage targets behaviour; static and bootstrap code is not meaningful to cover.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.stories.tsx', 'src/renderer/src/test/**', 'src/**/*.d.ts', 'src/renderer/src/main.tsx', 'src/renderer/src/design-system/icons/**'],
      reporter: ['text', 'json-summary', 'html'],
    },
    server: {
      fs: {
        // Workspace root: tests glob plugin manifests/docs from the sibling plugins/ tree (the repo
        // split), which lives beside Bespok3d, not under it.
        allow: [resolve(__dirname, '..')],
      },
      // @electron-toolkit/utils reads electron's own exports at import time. Left external it loads
      // natively, outside the module graph, where a test's electron mock never reaches it and the
      // import throws before a single test runs.
      deps: { inline: ['@electron-toolkit/utils'] },
    },
  },
})
