// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { app } from 'electron'

// A scripted run on a Mac someone is using (an agent driving the app over the remote-debugging port)
// must never put a window, a DevTools pane, a Dock icon or a menu bar in front of that person. The
// renderer still loads and runs hidden, so the run can drive it. Started with B3D_HEADLESS=1.

export function runsHeadless(): boolean {
  return process.env.B3D_HEADLESS === '1'
}

export function leaveTheScreenAlone(): void {
  if (!runsHeadless() || process.platform !== 'darwin') return
  app.setActivationPolicy('accessory')
}
