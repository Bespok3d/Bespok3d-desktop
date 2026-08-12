// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrinterRestartingModal } from './PrinterRestarting'

export default { title: 'Batch ops / PrinterRestartingModal' }

// The screen between the plugins going back and the recovery report: the printer is restarting and
// there is nothing to do but wait for it.
export function Waiting() {
  return <PrinterRestartingModal restartSeconds={42} />
}
