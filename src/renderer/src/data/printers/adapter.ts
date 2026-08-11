// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Printer } from '../types'

// The adapter driving a printer, out of the adapter set this build ships. Absent when the build carries
// no adapter by that id, which is the honest answer: there is then nothing to read a title, version or
// icon from, and the caller shows the bare id rather than inventing one.
export function printerAdapter(adapters: AdapterInfo[], printer: Printer): AdapterInfo | undefined {
  return adapters.find((adapter) => adapter.id === printer.adapter)
}
