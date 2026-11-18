// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The reboots the active watch carried out, as notices.
import type { RebootNotice } from '../../data/active-watch'
import type { Notice } from './notices'

function rebootNoticeId(rebootNotice: RebootNotice): string {
  return `active-watch:${rebootNotice.printerId}:${rebootNotice.noticeId}`
}

export function rebootNoticeItems(rebootNotices: RebootNotice[]): Notice[] {
  return rebootNotices.map((rebootNotice) => ({
    id: rebootNoticeId(rebootNotice),
    severity: 'warn',
    titleKey: 'notif.screen_stuck_reboot.title',
    bodyKey: 'notif.screen_stuck_reboot.body',
    params: { name: rebootNotice.printerName },
    happenedAt: rebootNotice.rebootedAt,
  }))
}
