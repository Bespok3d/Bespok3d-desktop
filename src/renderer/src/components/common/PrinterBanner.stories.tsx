// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PrinterBanner } from './PrinterBanner'

export default { title: 'Common / Printer banner' }

function noop() {}

// Something the user should know, with the one press that answers it.
export function WithAnAction() {
  return <PrinterBanner message="Junior is not running the Bespok3d daemon right now." actionLabel="Repair" onAction={noop} />
}

// Something the user should know that they cannot act on from here.
export function JustTheSentence() {
  return <PrinterBanner message="Root access is switched off on Junior, so Bespok3d cannot reach it over SSH." />
}
