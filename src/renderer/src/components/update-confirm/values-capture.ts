// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useRef, useState } from 'react'
import type { Plugin } from '../../data/types'
import type { UpdateAllPlan } from '../plugin-store/migrations'
import { planSpecs } from '../plugin-store/migrations'
import type { PendingUpdate } from '../batch-ops/pending-update'
import type { CapturedPluginValues } from '../plugin-store/select/batch-install'
import type { PrinterVars } from '../../../../main/store/vars-to-send'
import { batchPlugins, knownPluginValues, pluginsMissingValues, pluginsToAskThePrinter, planWithCapturedValues } from './missing-values'
import type { KnownPluginValues, PrinterPluginValues } from './missing-values'

// An Update all the user confirmed, held while they give the values some of its plugins still need.
export interface ValuesCapture {
  pending: PendingUpdate
  plan: UpdateAllPlan
  plugins: Plugin[]
  known: KnownPluginValues
}

// Read the way main reads it when the batch goes out: a printer that does not answer gets no
// defaults, so the user is asked for a required value instead of the printer refusing the plugin.
function printerValuesOf(printerId: string, pluginId: string): Promise<PrinterVars> {
  return window.b3d.store.pluginConfig(printerId, pluginId).then((values) => values ?? {}, (): PrinterVars => 'unreadable')
}

async function printerValuesFor(printerId: string, pluginIds: string[]): Promise<PrinterPluginValues> {
  const answers = await Promise.all(pluginIds.map((pluginId) => printerValuesOf(printerId, pluginId)))

  return Object.fromEntries(pluginIds.map((pluginId, position) => [pluginId, answers[position]]))
}

export async function valuesCaptureFor(pending: PendingUpdate, plan: UpdateAllPlan, catalogPlugins: Plugin[]): Promise<ValuesCapture> {
  const specs = planSpecs(plan)
  const plugins = batchPlugins(specs, catalogPlugins)
  const printerValues = await printerValuesFor(pending.printerId, pluginsToAskThePrinter(specs, plugins))
  const known = knownPluginValues(specs, plugins, printerValues)

  return { pending, plan, plugins: pluginsMissingValues(plugins, known), known }
}

// The step between "Update" and the batch: a plugin with a required setting nobody gave a value to is
// asked for it here, the way a single install asks on its form, instead of failing on the printer.
export function useValuesCapture(pending: PendingUpdate | null, catalogPlugins: Plugin[], onConfirm: (plan: UpdateAllPlan) => void, onCancel: () => void) {
  const [capture, setCapture] = useState<ValuesCapture | null>(null)
  const checking = useRef<PendingUpdate | null>(null)
  const latestPending = useRef(pending)
  const latestOnConfirm = useRef(onConfirm)
  latestPending.current = pending
  latestOnConfirm.current = onConfirm

  function releaseCheck(confirmed: PendingUpdate) {
    if (checking.current === confirmed) checking.current = null
  }

  // The printer may take seconds to answer; a second click on the same batch meanwhile is not a second
  // batch, and an answer for a batch the user has since left is dropped.
  async function confirmPicked(confirmed: PendingUpdate, specs: PluginUpdateSpec[]) {
    if (checking.current === confirmed) return
    checking.current = confirmed
    const plan = { updates: specs, migrations: confirmed.plan.migrations }
    const found = await valuesCaptureFor(confirmed, plan, catalogPlugins).finally(() => releaseCheck(confirmed))
    if (latestPending.current !== confirmed) return
    if (found.plugins.length === 0) {
      latestOnConfirm.current(plan)

      return
    }
    setCapture(found)
  }

  function confirmCaptured(captured: CapturedPluginValues) {
    if (!capture) return
    setCapture(null)
    onConfirm(planWithCapturedValues(capture.plan, captured))
  }

  function cancelCapture() {
    setCapture(null)
    onCancel()
  }

  return { capture: capture?.pending === pending ? capture : null, confirmPicked, confirmCaptured, cancelCapture }
}
