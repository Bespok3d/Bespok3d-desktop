// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import type { Printer, ConnectionReach } from '../data/types'
import { jinniLags } from '../data/printers'
import { useI18n } from '../i18n/context'
import { PrinterBanner } from './common/PrinterBanner'

export const EXPECTED_RESTART_GRACE_MS = 5 * 60 * 1000
export const POST_OPERATION_GRACE_MS = 30 * 1000

export function isWithinExpectedRestart(printer: Printer, now: number): boolean {
  const until = printer.expectedRestartUntil

  return typeof until === 'number' && now < until
}

// An enrolled, recoverable printer (daemon down, SSH open) needs either a daemon Repair or a full
// Recover. The one-shot writeLayerIntact probe is the discriminator: false means a firmware OTA reset
// the overlay so only a full re-enroll sticks; true (or not-yet-probed) means a daemon glitch a Repair
// fixes. The brief pre-probe window defaulting to Repair is safe: the op-time write-layer backstop
// stops a repair that cannot stick and routes it to Recovery.
export function repairOrRecover(
  args: { reach: ConnectionReach | undefined; enrolled: boolean; withinRestart: boolean; writeLayerIntact: boolean | undefined },
): 'recover' | 'repair' | null {
  if (!args.enrolled || args.withinRestart || args.reach !== 'recoverable') return null

  return args.writeLayerIntact === false ? 'recover' : 'repair'
}

function bannerAction(printer: Printer, now: number): 'recover' | 'repair' | null {
  if (printer.status !== 'online') return null

  return repairOrRecover({
    reach: printer.connection?.reach,
    enrolled: Boolean(printer.enrollmentLog),
    withinRestart: isWithinExpectedRestart(printer, now),
    writeLayerIntact: printer.writeLayerIntact,
  })
}

export function repairBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  return bannerAction(printer, now) === 'repair'
}

export function recoverBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  return bannerAction(printer, now) === 'recover'
}

// A printer that is alive (Moonraker / web UI answering) but with SSH off. Without root access we can
// neither enroll a new printer nor recover an enrolled one, so prompt the user to turn it back on
// regardless of enrollment state. Informational: the fix is on-device.
export function rootAccessBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  if (printer.status !== 'online') return false
  if (isWithinExpectedRestart(printer, now)) return false

  return printer.connection?.reach === 'alive-no-ssh'
}

export function driftedPluginCount(printer: Printer): number {
  if (!printer.daemonDrift) return 0

  return printer.daemonDrift.length
}

export function driftBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  if (printer.status !== 'managed') return false
  if (isWithinExpectedRestart(printer, now)) return false

  return driftedPluginCount(printer) > 0
}

// Tokens this app build knows how to word. A newer daemon may report a token this build predates;
// falling back to the unknown reason keeps a raw machine token from ever reaching the user.
const KNOWN_REBOOT_TOKENS: string[] = []

// The U1's screen blanks itself when it is left alone, and the printer used to report that ordinary
// blank as a screen that had died. Printers still running that version keep sending it, so it is
// dropped here as well: no user is told their working screen is dead while their printer catches up.
const REBOOT_TOKENS_NOT_WORTH_A_BANNER = ['display-pipe-wedged']

function rebootTokensWorthShowing(printer: Printer): string[] {
  return (printer.rebootRequired ?? []).filter((token) => !REBOOT_TOKENS_NOT_WORTH_A_BANNER.includes(token))
}

// Only the first token is shown, one line ("here is why"), never a list.
function rebootReasonToken(printer: Printer): string {
  const reportedToken = rebootTokensWorthShowing(printer)[0]

  return reportedToken && KNOWN_REBOOT_TOKENS.includes(reportedToken) ? reportedToken : 'unknown'
}

// The printer itself says it needs a power cycle to clear something (a wedged subsystem a restart
// fixes, not a config or plugin problem). Ranked above drift/printer-problem (more urgent: nothing
// else works right until it is restarted) and below recover/repair/root-access/deactivated (those
// mean the daemon or root access itself is not there to ask in the first place).
export function rebootBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  if (printer.status !== 'managed') return false
  if (isWithinExpectedRestart(printer, now)) return false

  return rebootTokensWorthShowing(printer).length > 0
}

export function printerProblemCount(printer: Printer): number {
  if (!printer.printerProblems) return 0

  return printer.printerProblems.length
}

// Something is wrong with the printer itself, not with one plugin's links: it no longer includes
// bespok3d in its own config, part of the bespok3d tree is gone, a plugin was left half removed. A
// printer with no plugins left has no drift to show and can still be in this state, which is exactly
// the case that used to render no banner at all.
export function printerProblemBannerCondition(printer: Printer, now: number = Date.now()): boolean {
  if (printer.status !== 'managed') return false
  if (isWithinExpectedRestart(printer, now)) return false

  return printerProblemCount(printer) > 0
}

export function jinniBannerCondition(printer: Printer, bundledVersion: string, now: number = Date.now()): boolean {
  if (printer.status !== 'managed') return false
  if (isWithinExpectedRestart(printer, now)) return false
  // A pending daemon update redeploys the jinni too (deploy-daemon runs uploadAdapterJinni), so we
  // never prompt for the jinni separately while a daemon update is available: one button, no
  // ordering confusion. The standalone jinni banner fires only when the daemon is current.
  if (printer.daemonUpdateAvailable) return false

  return jinniLags(printer.jinniVersion, bundledVersion)
}

function useTickWhilePending(target: number | undefined): void {
  const [, forceTick] = useState(0)
  function scheduleTickAtTarget() {
    if (!target) return undefined
    const remaining = target - Date.now()
    if (remaining <= 0) return undefined
    const timeoutHandle = setTimeout(() => forceTick((counter) => counter + 1), remaining + 50)

    return () => clearTimeout(timeoutHandle)
  }
  useEffect(scheduleTickAtTarget, [target])
}

export function PrinterBanners({ selectedPrinter, bundledJinniVersion, onRepair, onRecover, onReactivate, onRecoverDrift, onUpdateJinni, onReboot }: { selectedPrinter: Printer | null; bundledJinniVersion?: string; onRepair: (id: string) => void; onRecover: (id: string) => void; onReactivate: (id: string) => void; onRecoverDrift: (id: string) => void; onUpdateJinni: (id: string) => void; onReboot: (id: string) => void }) {
  const { t } = useI18n()
  useTickWhilePending(selectedPrinter?.expectedRestartUntil)
  if (!selectedPrinter) return null

  if (recoverBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.recover_body', { name: selectedPrinter.nick || selectedPrinter.model })}
        actionLabel={t('banner.recover_action')}
        onAction={() => onRecover(selectedPrinter.id)}
      />
    )
  }

  if (repairBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.repair_body', { name: selectedPrinter.nick || selectedPrinter.model })}
        actionLabel={t('banner.repair_action')}
        onAction={() => onRepair(selectedPrinter.id)}
      />
    )
  }

  if (rootAccessBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.root_access_body', { name: selectedPrinter.nick || selectedPrinter.model })}
      />
    )
  }

  if (selectedPrinter.status === 'deactivated') {
    return (
      <PrinterBanner
        message={<><strong>{selectedPrinter.nick || selectedPrinter.model}</strong>{' '}{t('banner.deactivated_hint')}</>}
        actionLabel={t('printers.reactivate')}
        onAction={() => onReactivate(selectedPrinter.id)}
      />
    )
  }

  if (rebootBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.reboot_body', { name: selectedPrinter.nick || selectedPrinter.model, reason: t(`banner.reboot_reason.${rebootReasonToken(selectedPrinter)}`) })}
        actionLabel={t('banner.reboot_action')}
        onAction={() => onReboot(selectedPrinter.id)}
      />
    )
  }

  if (printerProblemBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.printer_problem_body', { name: selectedPrinter.nick || selectedPrinter.model, count: String(printerProblemCount(selectedPrinter)) })}
        actionLabel={t('banner.printer_problem_action')}
        onAction={() => onRecoverDrift(selectedPrinter.id)}
      />
    )
  }

  if (driftBannerCondition(selectedPrinter)) {
    return (
      <PrinterBanner
        message={t('banner.drift_body', { name: selectedPrinter.nick || selectedPrinter.model, count: String(driftedPluginCount(selectedPrinter)) })}
        actionLabel={t('banner.drift_action')}
        onAction={() => onRecoverDrift(selectedPrinter.id)}
      />
    )
  }

  if (bundledJinniVersion && jinniBannerCondition(selectedPrinter, bundledJinniVersion)) {
    return (
      <PrinterBanner
        message={t('banner.jinni_body', { name: selectedPrinter.nick || selectedPrinter.model, version: bundledJinniVersion })}
        actionLabel={t('banner.jinni_action')}
        onAction={() => onUpdateJinni(selectedPrinter.id)}
      />
    )
  }

  return null
}
