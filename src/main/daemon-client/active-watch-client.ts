// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The active watch's setting. A daemon older than the watch answers its route with 404, which reads
// as "this printer has no active watch", never as an error.
import type { PrinterRecord } from '../printers'
import { doRequest, isNotFound } from './transport'

export type ActiveWatchRemedyChoice = 'notify' | 'reboot-when-idle'

export interface ActiveWatchSetting {
  enabled: boolean
  files: string[]
  remedies: Record<string, ActiveWatchRemedyChoice>
}

export async function fetchActiveWatchSetting(record: PrinterRecord): Promise<ActiveWatchSetting | null> {
  try {
    return JSON.parse(await doRequest(record, 'GET', '/active-watch')) as ActiveWatchSetting
  } catch (failure) {
    if (isNotFound(failure)) return null
    throw failure
  }
}

export async function saveActiveWatchSetting(record: PrinterRecord, setting: ActiveWatchSetting): Promise<ActiveWatchSetting> {
  const text = await doRequest(record, 'PUT', '/active-watch', Buffer.from(JSON.stringify(setting)), 'application/json')

  return JSON.parse(text) as ActiveWatchSetting
}
