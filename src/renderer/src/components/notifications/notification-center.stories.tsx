// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotificationCenter } from './NotificationCenter'
import { addRebootNotice } from '../../data/active-watch/reboot-notices'

export default { title: 'App / Notification center' }

function ignoreChoice(): void {}

// Open the bell to read the notice of a printer that restarted itself because its screen was stuck.
export function PrinterRestartedItself() {
  addRebootNotice({ printerId: 'printer-1', printerName: 'Junior', noticeId: 'notice-1', rebootedAt: Date.now() - 20 * 60 * 1000 })

  return <NotificationCenter onOpenSettings={ignoreChoice} onOpenPlugin={ignoreChoice} installedVersions={{}} installedSources={{}} />
}
