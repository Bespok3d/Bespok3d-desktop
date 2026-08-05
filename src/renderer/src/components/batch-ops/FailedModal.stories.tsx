// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { BatchFailedModal } from './FailedModal'

export default { title: 'Batch ops / BatchFailedModal' }

// The reason the printer gave, verbatim: the daemon's own sentence names what the batch would have
// restarted and when to come back.
const PRINTING = 'The printer is busy: this would restart klipper and moonraker, interrupting the print. Try again when it is idle.'

export function UpdateRefusedWhilePrinting() {
  return <BatchFailedModal variant="update" reason={PRINTING} onRepairPrinter={() => {}} onClose={() => {}} />
}

export function InstallRefusedWhilePrinting() {
  return <BatchFailedModal variant="install" reason={PRINTING} onRepairPrinter={() => {}} onClose={() => {}} />
}

export function UninstallRefusedWhilePrinting() {
  return <BatchFailedModal variant="uninstall" reason={PRINTING} onRepairPrinter={() => {}} onClose={() => {}} />
}

// The printer never answered at all: not a refusal with a sentence behind it, just whatever the
// network said. It still reaches the user rather than ending as a spinner that stops.
export function RecoveryUnreachable() {
  return <BatchFailedModal variant="recovery" reason="connect ETIMEDOUT 192.0.2.51:7130" onRepairPrinter={() => {}} onClose={() => {}} />
}

// The daemon and the driver beside it do not match, so every operation ends the same way. This is the
// one refusal the user can act on from here: setting the printer up again puts a matched pair on it.
export function UpdateRefusedByMismatchedSetup() {
  return <BatchFailedModal variant="update" reason="ProtocolError: AttributeError: 'SnapmakerU1Jinni' object has no attribute 'service_control'" onRepairPrinter={() => {}} onClose={() => {}} />
}
