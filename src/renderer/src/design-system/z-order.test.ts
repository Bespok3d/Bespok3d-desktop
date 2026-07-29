// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { MODAL_TOP_LEVEL } from '../components/common/overlay/modal-stack'

// The printer dropdown and the notification center both live INSIDE the header, which is the stacking
// context that lifts them above page content (the trapped .printer-menu z:62 / .notif-panel z:201 cannot
// out-stack a sibling of the header on their own). Every modal scrim now takes its z-index from the shared
// Modal scaffold's open-order stack (components/common/overlay/modal-stack.ts), which hands out levels in
// the band [MODAL_BASE_LEVEL, MODAL_TOP_LEVEL]. The header MUST out-stack that WHOLE band, or an open
// dropdown/notification panel sinks under a modal shade - and if the header loses its z-index entirely it
// stops being a stacking context and the store content (a later sibling at z:auto) paints over the menu.
// This pins that invariant on the fast gate; the real-paint backstop lives in e2e/printer-dropdown.spec.ts.
//
// If this ever regresses again, the durable fix is to stop relying on the header being the stacking
// context and PORTAL the menu + notification panel into a top-level overlay above the modals (see the note
// in doc/codebase-fix/done.md). Lucio's call: keep the current header-z approach until it regresses.

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_CSS = readFileSync(join(HERE, 'app.css'), 'utf8')

function zIndexForSelector(cssText: string, selector: string): number | null {
  var zIndex: number | null = null
  postcss.parse(cssText).walkRules((rule) => {
    const matchesSelector = rule.selector.split(',').some((part) => part.trim() === selector)
    if (!matchesSelector) return
    rule.walkDecls('z-index', (declaration) => { zIndex = Number(declaration.value) })
  })

  return zIndex
}

describe('header dropdown + notification z-order invariant', () => {
  const headerZ = zIndexForSelector(APP_CSS, '.header')
  const notifScrimZ = zIndexForSelector(APP_CSS, '.notif-scrim')
  const notifPanelZ = zIndexForSelector(APP_CSS, '.notif-panel')

  it('the header carries an explicit positive z-index (it is the stacking context that lifts the menu)', () => {
    expect(headerZ, '.header must declare z-index').not.toBeNull()
    expect(headerZ as number).toBeGreaterThan(0)
  })

  it('the header out-stacks the entire modal band so the dropdown/notification stay reachable over any modal', () => {
    expect(headerZ as number).toBeGreaterThan(MODAL_TOP_LEVEL)
  })

  it('the notification panel sits above its own dismiss scrim', () => {
    expect(notifScrimZ, '.notif-scrim must declare z-index').not.toBeNull()
    expect(notifPanelZ, '.notif-panel must declare z-index').not.toBeNull()
    expect(notifPanelZ as number).toBeGreaterThan(notifScrimZ as number)
  })
})
