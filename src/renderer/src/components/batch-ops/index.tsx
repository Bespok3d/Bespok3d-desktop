import { useState, useEffect } from 'react'
import { useI18n } from '../../i18n/context'
import { Modal } from '../common/overlay/Modal'
import { PanelSpinner } from '../common/feedback/PanelSpinner'
import { OtaRecoveryResultsModal } from './ResultsModal'
import { BatchInstallProgress } from './InstallProgress'
import { pingAndUpdate, refreshEndpoints } from '../../data/printers'
import { reduceBatchProgress } from './progress'
import './batch-ops.css'
import type { BatchProgressState } from './progress'
import type { Printer } from '../../data/types'
import type { RecoverResult } from '@bespok3d/contract'

type BatchVariant = 'recovery' | 'update' | 'install' | 'uninstall'

// Each batch op's in-flight spinner copy, keyed by variant so the title/body live in one place.
const SPINNER_COPY: Record<BatchVariant, { title: string; body: string }> = {
  recovery: { title: 'recovering.title', body: 'recovering.body' },
  update: { title: 'updating_all.title', body: 'updating_all.body' },
  install: { title: 'installing_selected.title', body: 'installing_selected.body' },
  uninstall: { title: 'uninstalling_selected.title', body: 'uninstalling_selected.body' },
}

function SpinnerModal({ title, body }: { title: string; body: string }) {
  return (
    <Modal dismissable={false} className="size-sm">
      <div className="modal-head">
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="batch-progress-body">
        <PanelSpinner />
      </div>
    </Modal>
  )
}

// What shows while a batch op is in flight: the live per-plugin progress when the daemon's feed has
// reached us (update-all and install-selected), otherwise the spinner (recover, or an older daemon
// with no batch feed, or the brief moment before the first event arrives).
function BatchBusyView({ variant, progress }: { variant: BatchVariant; progress: BatchProgressState | null | undefined }) {
  const { t } = useI18n()
  const copy = SPINNER_COPY[variant]
  if (variant !== 'recovery' && progress) return <BatchInstallProgress title={t(copy.title)} state={progress} />

  return <SpinnerModal title={t(copy.title)} body={t(copy.body)} />
}

// A batch op (recover / update-all / install-selected) shows the same two-step UI: live progress while
// it runs, then the per-plugin results report. One component for all three so the variants cannot drift.
export function BatchOpModal({ variant, busy, result, progress, onClose }: {
  variant: BatchVariant
  busy: boolean
  result: RecoverResult | null
  progress?: BatchProgressState | null
  onClose: () => void
}) {
  return (
    <>
      {busy && !result && <BatchBusyView variant={variant} progress={progress} />}
      {result && <OtaRecoveryResultsModal results={result} variant={variant} onClose={onClose} />}
    </>
  )
}

// A single batch op: update-all or install-selected, each posting its set of plugins to the daemon and
// returning per-plugin results.
type BatchPoster = (printerId: string, specs: PluginUpdateSpec[]) => Promise<RecoverResult>

// The daemon batch operations (OTA recover, update-all, install-selected, uninstall-selected). Recover
// has its own daemon route; update-all rides update-batch and install-selected rides install-batch (a
// fresh-install batch that also checks conflicts). Both apply every package and restart the affected
// services exactly once, so a multi-plugin install bounces the display compositor once, not once per
// plugin (the Bug A defense).
export function useBatchOps(
  printers: Printer[],
  setPrinters: (update: Printer[] | ((prev: Printer[]) => Printer[])) => void,
) {
  const [recoveryResults, setRecoveryResults] = useState<RecoverResult | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [updateAllResult, setUpdateAllResult] = useState<RecoverResult | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [installBatchResult, setInstallBatchResult] = useState<RecoverResult | null>(null)
  const [installingBatch, setInstallingBatch] = useState(false)
  const [uninstallBatchResult, setUninstallBatchResult] = useState<RecoverResult | null>(null)
  const [uninstallingBatch, setUninstallingBatch] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null)
  useEffect(() => window.b3d.store.onBatchProgress(({ printerId, event }) =>
    setBatchProgress((prev) => reduceBatchProgress(prev, printerId, event)),
  ), [])
  // Pull installed counts (ping) and fresh endpoints (fly-out) into App state after any batch op, so
  // the dropdown never reads stale until a manual reload (the single-op path does the same).
  function refreshAfterBatch(printerId: string) {
    const printer = printers.find((candidate) => candidate.id === printerId)
    if (printer) pingAndUpdate(printer, setPrinters)
    refreshEndpoints(printerId, setPrinters)
  }
  function runRecover(printerId: string) {
    setRecovering(true)
    window.b3d.store.recover(printerId)
      .then((results) => { setRecovering(false); setRecoveryResults(results) })
      .catch(() => setRecovering(false))
  }
  function runBatch(printerId: string, specs: PluginUpdateSpec[], setBusy: (busy: boolean) => void, setResult: (result: RecoverResult) => void, post: BatchPoster) {
    setBusy(true)
    setBatchProgress(null)
    post(printerId, specs)
      .then((result) => {
        setBusy(false)
        setResult(result)
        refreshAfterBatch(printerId)
      })
      .catch(() => setBusy(false))
  }
  function runUpdateAll(printerId: string, updates: PluginUpdateSpec[]) {
    runBatch(printerId, updates, setUpdatingAll, setUpdateAllResult, window.b3d.store.updateBatch)
  }
  function runInstallBatch(printerId: string, specs: PluginUpdateSpec[]) {
    runBatch(printerId, specs, setInstallingBatch, setInstallBatchResult, window.b3d.store.installBatch)
  }
  function runUninstallBatch(printerId: string, pluginIds: string[], cascade: boolean) {
    setUninstallingBatch(true)
    window.b3d.store.uninstallBatch(printerId, pluginIds, cascade)
      .then((result) => {
        setUninstallingBatch(false)
        setUninstallBatchResult(result)
        refreshAfterBatch(printerId)
      })
      .catch(() => setUninstallingBatch(false))
  }

  return {
    recoveryResults, setRecoveryResults, recovering,
    updateAllResult, setUpdateAllResult, updatingAll, runUpdateAll,
    installBatchResult, setInstallBatchResult, installingBatch, runInstallBatch,
    uninstallBatchResult, setUninstallBatchResult, uninstallingBatch, runUninstallBatch,
    batchProgress, runRecover,
  }
}
