// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { Button } from '../../../common/Button'
import { UploadBar } from '../../../upload'
import { IconCheckCircle } from '../../../../design-system/icons'
import { InstallLogShell } from './shell'
import { InstallLogView } from './view'

// The live step trail while an install is running. Each message is a phase that completed; the last
// one is in progress (spinner). The daemon streams these over the install-progress feed.
function LiveSteps({ steps }: { steps: string[] }) {
  const { t } = useI18n()

  return (
    <div className="log-body live-steps">
      {steps.length === 0 && <div className="install-live-hint">{t('install.live.starting')}</div>}
      {steps.map((step, idx) => (
        <div key={idx} className="install-live-step">
          {idx === steps.length - 1
            ? <div className="au-spinner install-step-spinner" />
            : <IconCheckCircle size={13} className="install-icon-ok" />}
          <span>{step}</span>
        </div>
      ))}
    </div>
  )
}

function runModalTitle(t: ReturnType<typeof useI18n>['t'], working: boolean, failed: boolean): string {
  if (working) return t('install.live.title')

  return failed ? t('install.run.failed') : t('install.run.done')
}

// The install run modal: live phases while installing, then the structured result log. It stays open
// until the user dismisses it, so the report does not vanish the instant the install finishes. A hard
// error (the install POST itself rejected) is owned by InstallErrorModal, not here.
export function InstallRunModal({ phase, steps, log, pluginName, printerId, onClose }: {
  phase: 'idle' | 'working' | 'error'
  steps: string[]; log: InstallLog | null; pluginName: string; printerId?: string; onClose: () => void
}) {
  const { t } = useI18n()
  const working = phase === 'working'

  return (
    <InstallLogShell title={runModalTitle(t, working, log?.ok === false)} pluginName={pluginName} onClose={onClose}>
      {working && <UploadBar printerId={printerId} />}
      {working ? <LiveSteps steps={steps} /> : log && <InstallLogView log={log} />}
      {!working && (
        <div className="install-run-foot">
          <Button variant="primary" onClick={onClose}>{t('install.run.dismiss')}</Button>
        </div>
      )}
    </InstallLogShell>
  )
}
