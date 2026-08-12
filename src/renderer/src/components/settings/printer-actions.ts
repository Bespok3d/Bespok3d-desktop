// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext } from 'react'

// Every action the Settings shell can take on a printer. The Settings shell receives these from the
// app and provides them through context so the Printers pane reads them directly, instead of the
// shell drilling 13 callbacks through the content router on the way down.
export interface PrinterActions {
  onAddPrinter: () => void
  onRemovePrinter: (id: string) => void
  onUpdatePrinterIcon: (id: string, color?: string, image?: string, size?: number) => void
  // forced: only the Force menu passes it. It waives the refusal to put a printer back onto an older
  // daemon than it reports running, and nothing else.
  onEnrollPrinter: (id: string, forced?: boolean) => void
  onRepairPrinter: (id: string, forced?: boolean) => void
  onRecoverPrinter: (id: string, forced?: boolean) => void
  onReinstallPlugins: (id: string) => void
  onViewEnrollmentLog: (id: string) => void
  onUpdateDaemon: (id: string) => void
  onUpdateJinni: (id: string) => void
  onDeactivatePrinter: (id: string) => void
  onReactivatePrinter: (id: string) => void
  onUninstallPrinter: (id: string) => void
  onSetCustomSshCredentials: (id: string, value: boolean) => void
}

export const PrinterActionsContext = createContext<PrinterActions | null>(null)

export function usePrinterActions(): PrinterActions {
  const actions = useContext(PrinterActionsContext)
  if (!actions) throw new Error('usePrinterActions must be used within a PrinterActionsContext provider')

  return actions
}
