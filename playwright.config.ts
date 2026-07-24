import { defineConfig } from '@playwright/test'

// Functional E2E against the REAL built app (real main/preload/IPC/renderer), driven by
// Playwright-electron. Not part of the fast `check.sh` gate; run via scripts/e2e.sh (which builds
// the app first). Pixel/visual-regression baselines are deferred until a fixed render environment
// is pinned (Mac vs Linux antialiasing differs); see doc/testing.md.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  // Serial across files, not just within one: printer-dropdown.spec.ts and refused-install.spec.ts
  // each bind the stub daemon to the same fixed 127.0.0.1:4269 (stub-daemon.ts - the app will not
  // probe any other port), so two of these files racing on different workers is a real EADDRINUSE
  // flake, not a theoretical one.
  workers: 1,
  forbidOnly: true,
  reporter: 'list',
})
