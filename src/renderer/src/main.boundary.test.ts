// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source-assert, not render-assert: main.tsx calls createRoot().render() at module top level, so
// importing it would mount a real React tree. Reading it as text guards the structure without that.
// This holds the Resilience rule: a future edit cannot silently unwrap the app from its ErrorBoundary,
// which would let one render throw white-screen the whole UI.
const mainSource = readFileSync(fileURLToPath(new URL('./main.tsx', import.meta.url)), 'utf8')

describe('renderer bootstrap keeps the app inside the ErrorBoundary', () => {
  it('imports ErrorBoundary', () => {
    expect(mainSource).toMatch(/import\s*\{[^}]*\bErrorBoundary\b[^}]*\}\s*from/)
  })

  it('nests <App> inside <ErrorBoundary>', () => {
    const boundaryOpen = mainSource.indexOf('<ErrorBoundary>')
    const boundaryClose = mainSource.indexOf('</ErrorBoundary>')
    const appMount = mainSource.indexOf('<App')

    expect(boundaryOpen).toBeGreaterThanOrEqual(0)
    expect(boundaryClose).toBeGreaterThan(boundaryOpen)
    expect(appMount).toBeGreaterThan(boundaryOpen)
    expect(appMount).toBeLessThan(boundaryClose)
  })
})
