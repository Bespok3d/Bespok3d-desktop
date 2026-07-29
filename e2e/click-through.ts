// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

// Clicking a control that the app repaints under you.
//
// The printers pane renders its actions from live printer status (printer-row.tsx: the Enroll CTA only
// exists while the printer's action is 'enroll'), and status arrives from a background poll. So the
// control can be torn down and rebuilt between the moment Playwright resolves it and the moment the
// click lands, which swallows the click: the run then fails waiting for a panel that was never opened.
// Retrying the CLICK against the state it is supposed to produce removes that race without hiding a
// real break, because the step still fails when the panel never appears. It is not a test retry: the
// assertion after it is untouched, and an already-open panel is left alone instead of clicked twice.

export async function clickUntilVisible(trigger: Locator, opened: Locator, budgetMs = 45_000): Promise<void> {
  await expect(async () => {
    if (await opened.isVisible()) return
    await trigger.click({ timeout: 5_000 })
    await opened.waitFor({ state: 'visible', timeout: 5_000 })
  }).toPass({ timeout: budgetMs, intervals: [500, 1_000, 2_000] })
}

// The dismiss direction. The trigger is always clicked, never skipped on a "looks hidden" reading: a
// control that has not painted yet reads as hidden exactly like one that is already dismissed, and
// skipping the click there would leave the dialog standing. Playwright's click waits for the control
// to be there, so the caller's contract is simply that this control disappears BECAUSE it was clicked.
export async function clickUntilGone(trigger: Locator, dismissed: Locator, budgetMs = 30_000): Promise<void> {
  await expect(async () => {
    await trigger.click({ timeout: 5_000 })
    await dismissed.waitFor({ state: 'hidden', timeout: 5_000 })
  }).toPass({ timeout: budgetMs, intervals: [500, 1_000, 2_000] })
}
