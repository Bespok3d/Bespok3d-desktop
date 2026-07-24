import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// In-vitro suite: real app code (ssh transport, daemon client, adapter steps) driven against a Docker
// fake device. Requires Docker; runs via scripts/invitro.sh, NOT part of the fast `npm test` gate.
export default defineConfig({
  resolve: {
    alias: {
      electron: resolve(__dirname, 'tests/invitro/electron-stub.ts'),
      '@plugins': resolve(__dirname, '../plugins'),
      '@adapter-sdk': resolve(__dirname, 'src/main/adapter-loader/index.ts'),
      '@adapters': resolve(__dirname, '../adapters'),
      '@bespok3d/contract': resolve(__dirname, '../lib_bespok3d/ts/contract/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/invitro/**/*.invitro.test.ts'],
    // Serial: a daemon-device file publishes host port 4269, and two at once would collide on it.
    fileParallelism: false,
    // In-source order: the lifecycle suite's deactivate/teardown are whole-system ops that must run
    // after the per-plugin tests (they neutralize/remove every plugin + write the global marker).
    sequence: { shuffle: false },
    testTimeout: 60000,
    hookTimeout: 60000,
    server: {
      fs: { allow: [resolve(__dirname, '..')] },
    },
  },
})
