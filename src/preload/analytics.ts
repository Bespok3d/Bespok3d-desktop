// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'

// The answer already stored, and whether this run should ask for one. The shape is main's own,
// imported rather than restated, so the two sides of the channel cannot drift apart. A type is erased
// at build time, so nothing of the main process is pulled into the window by this line.
import type { UsageReportingConsent } from '../main/analytics/consent'

export type { UsageReportingConsent }

// The window has one thing it may say about a break, and it is the kind of break. It cannot name the
// event, cannot attach properties, and cannot pick a part of the app that main does not already know
// about: main checks both before anything is sent, so the worst a page can do here is miscount.
//
// Consent is a channel of its own rather than a settings write, because the answer is what decides
// whether anything is sent at all and it is main that reads it before every send.
export const analyticsApi = {
  reportRenderFailure: (errorClass: string): Promise<void> =>
    ipcRenderer.invoke('analytics:renderFailure', errorClass),
  consent: (): Promise<UsageReportingConsent> => ipcRenderer.invoke('analytics:consent'),
  setConsent: (granted: boolean): Promise<void> => ipcRenderer.invoke('analytics:setConsent', granted),
}
