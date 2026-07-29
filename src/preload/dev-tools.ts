// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ipcRenderer } from 'electron'
import type { PatchSession, ApplyRequest } from '../main/dev-tools/types'

export const devToolsApi = {
  patch: {
    session: (
      patchId: string,
      targetId: string,
      targetName: string,
      targetContent: string,
      patchContent: string,
    ): Promise<PatchSession> =>
      ipcRenderer.invoke('devtools:patch:session', patchId, targetId, targetName, targetContent, patchContent),
    apply: (req: ApplyRequest, targetContent: string, hunks: unknown): Promise<string> =>
      ipcRenderer.invoke('devtools:patch:apply', req, targetContent, JSON.stringify(hunks)),
  },
}
