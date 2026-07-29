// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { Printer, ConnectionReach } from '../data/types'
import { jinniLags } from '../data/printers'
import { useI18n } from '../i18n/context'
import { Button } from './common/Button'
import './printer-banners.css'

export const EXPECTED_RESTART_GRACE_MS = 5 * 60 * 1000
export const POST_OPERATION_GRACE_MS = 30 * 1000

function PrinterBanner({ message, actionLabel, onAction }: { message: ReactNode; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="printer-banner">
      <span className="printer-banner-msg">{message}</span>
      {actionLabel && onAction && <Button size="sm" className="printer-banner-action" onClick={onAction}>{actionLabel}</Button>}
    </div>
  )
}

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

export function PrinterBanners({ selectedPrinter, bundledJinniVersion, onRepair, onRecover, onReactivate, onRecoverDrift, onUpdateJinni }: { selectedPrinter: Printer | null; bundledJinniVersion?: string; onRepair: (id: string) => void; onRecover: (id: string) => void; onReactivate: (id: string) => void; onRecoverDrift: (id: string) => void; onUpdateJinni: (id: string) => void }) {
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
