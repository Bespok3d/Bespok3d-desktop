// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import cx from '../../../utils/cx'
import { Group } from '../../common/Group'
import { Explainer } from '../../common/content/Explainer'
import { JinniCaution } from '../JinniCaution'
import { IconChevron } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import type { Printer } from '../../../data/types'
import './adapters.css'

interface AdapterCardProps {
  adapter: AdapterInfo
  jinniPrinter?: Printer
}

function AdapterJinni({ printer }: { printer?: Printer }) {
  const { t } = useI18n()
  if (!printer) {
    return (
      <div className="adapter-jinni-empty">
        {t('adapters.jinni_desc')}
      </div>
    )
  }
  const flags = printer.jinniCapabilities ?? []

  return (
    <>
      <div className="adapter-defaults">
        <div className="adapter-defaults-row">
          <span className="adapter-defaults-key">{t('adapters.jinni_version')}</span>
          <span className="adapter-defaults-val mono">{printer.jinniVersion}</span>
        </div>
        {flags.length > 0 && (
          <div className="adapter-defaults-row">
            <span className="adapter-defaults-key">{t('adapters.capabilities')}</span>
            <span className="adapter-defaults-val mono">{flags.join(', ')}</span>
          </div>
        )}
      </div>
      <JinniCaution extras={printer.jinniExtras ?? []} />
    </>
  )
}

function AdapterDefaultsTable({ defaults }: { defaults: AdapterInfo['defaults'] }) {
  const { t } = useI18n()

  return (
    <div className="adapter-defaults">
      <div className="adapter-defaults-row">
        <span className="adapter-defaults-key">{t('adapters.ssh_user')}</span>
        <span className="adapter-defaults-val mono">{defaults.sshUser}</span>
      </div>
      <div className="adapter-defaults-row">
        <span className="adapter-defaults-key">{t('adapters.port')}</span>
        <span className="adapter-defaults-val mono">{defaults.sshPort}</span>
      </div>
      <div className="adapter-defaults-row">
        <span className="adapter-defaults-key">{t('adapters.default_password')}</span>
        <span className="adapter-defaults-val mono">{defaults.sshPasswordHint}</span>
      </div>
      <div className="adapter-defaults-row">
        <span className="adapter-defaults-key">{t('adapters.runtime_user')}</span>
        <span className="adapter-defaults-val mono">{defaults.runtimeUser}</span>
      </div>
    </div>
  )
}

function AdapterCard({ adapter, jinniPrinter }: AdapterCardProps) {
  const { t } = useI18n()
  const [stepsOpen, setStepsOpen] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)

  return (
    <div className="adapter-card">
      <div className="adapter-card-head">
        <div className="adapter-card-meta">
          <div className="adapter-card-title">{adapter.title}</div>
          <div className="adapter-card-sub">
            <span>{adapter.vendor}</span>
            <span className="adapter-sep">·</span>
            <span className="adapter-id">{adapter.id}</span>
            <span className="adapter-sep">·</span>
            <span className="u-hint">v{adapter.version}</span>
          </div>
        </div>
      </div>

      <div className="adapter-card-desc">{adapter.description}</div>

      <AdapterDefaultsTable defaults={adapter.defaults} />

      <AdapterJinni printer={jinniPrinter} />

      {adapter.envVars.length > 0 && (
        <>
          <button
            className="adapter-steps-toggle"
            onClick={() => setEnvOpen((isOpen) => !isOpen)}
          >
            <span>{t('adapters.paths_env', { count: adapter.envVars.length })}</span>
            <span className={cx('enroll-expand-icon', envOpen && 'open')}>
              <IconChevron size={11} />
            </span>
          </button>

          {envOpen && (
            <div className="adapter-env-table">
              {adapter.envVars.map((envVar) => (
                <div key={envVar.name} className="adapter-env-row">
                  <span className="adapter-env-name mono">{envVar.name}</span>
                  <span className="adapter-env-value mono">{envVar.value}</span>
                  <span className="adapter-env-desc">{envVar.description}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        className="adapter-steps-toggle"
        onClick={() => setStepsOpen((isOpen) => !isOpen)}
      >
        <span>{t('adapters.enroll_steps', { count: adapter.enrollSteps.length })}</span>
        <span className={cx('enroll-expand-icon', stepsOpen && 'open')}>
          <IconChevron size={11} />
        </span>
      </button>

      {stepsOpen && (
        <div className="adapter-steps">
          {adapter.enrollSteps.map((step, idx) => (
            <div key={step.id} className="adapter-step-row">
              <span className="adapter-step-num">{idx + 1}</span>
              <div className="adapter-step-content">
                <Explainer brief={step.label} detail={step.detail} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CONTRACT_FIELDS: Array<{ field: string; type: string; description: string }> = [
  { field: 'id', type: 'string', description: 'Unique adapter identifier, e.g. "snapmaker-u1". Stored on each printer record.' },
  { field: 'title', type: 'string', description: 'Human-readable name shown in the UI.' },
  { field: 'vendor', type: 'string', description: 'Printer manufacturer.' },
  { field: 'version', type: 'string', description: 'Adapter version (semver).' },
  { field: 'description', type: 'string', description: 'Short paragraph describing the adapter: what printer it covers, how it works, any caveats.' },
  { field: 'defaults.sshUser', type: 'string', description: 'SSH username for connecting to the printer (e.g. "root"). Shown pre-filled in the enrollment credentials form.' },
  { field: 'defaults.sshPort', type: 'number', description: 'SSH port. Pre-filled in the enrollment form.' },
  { field: 'defaults.sshPasswordHint', type: 'string', description: 'Default or well-known password shown as a hint. Users can override it.' },
  { field: 'defaults.runtimeUser', type: 'string', description: 'OS user that runs Klipper and plugin services (e.g. "lava"). Used by enrollment steps for chown/chmod operations.' },
  { field: 'envVars', type: 'AdapterEnvVar[]', description: 'Environment variables and paths the adapter defines. Shown in the UI as a reference for plugin and adapter authors.' },
  { field: 'envVars[].name', type: 'string', description: 'Variable name, e.g. "BESPOK3D_PLUGINS".' },
  { field: 'envVars[].value', type: 'string', description: 'The actual value (path, username, etc.).' },
  { field: 'envVars[].description', type: 'string', description: 'What this variable is for; shown next to the value in the adapter inspector.' },
  { field: 'enrollSteps', type: 'EnrollStep[]', description: 'Ordered list of installation steps. Each step runs an SSH command or file operation. Steps must be idempotent.' },
  { field: 'enrollSteps[].id', type: 'string', description: 'Unique step ID used for retry-from and log references.' },
  { field: 'enrollSteps[].label', type: 'string', description: 'User-facing step name; plain language, no shell commands or paths.' },
  { field: 'enrollSteps[].detail', type: 'string', description: 'Technical description shown in the Explainer "i" tooltip: what commands run, what they modify, why.' },
  { field: 'enrollSteps[].run', type: '(ssh, ctx) => Promise<void>', description: 'Async function that performs the step. Receives an SshSession and EnrollContext (printerId, ip, credentials, runtimeUser). Throws on failure.' },
  { field: 'verifyEnrolled', type: '(ssh) => Promise<boolean>', description: 'True only when the printer is set up AND that setup will persist (its write layer is intact and the workspace is present). Goes false after a firmware update wipes the overlay, which is how a repair tells an updated printer (needs full recovery) from a daemon glitch.' },
]

function InterfaceContract() {
  const [open, setOpen] = useState(false)

  return (
    <div className="adapter-contract">
      <button className="adapter-steps-toggle" onClick={() => setOpen((isOpen) => !isOpen)}>
        <span>Interface contract: AdapterDefinition</span>
        <span className={cx('enroll-expand-icon', open && 'open')}>
          <IconChevron size={11} />
        </span>
      </button>

      {open && (
        <div className="adapter-contract-body">
          <p className="adapter-contract-intro">
            Any adapter registered with <span className="mono">registerAdapter()</span> must satisfy this shape.
            The app calls these fields during enrollment, adapter lookup, and credential pre-fill.
          </p>
          <div className="adapter-contract-table">
            <div className="adapter-contract-header">
              <span>Field</span>
              <span>Type</span>
              <span>Description</span>
            </div>
            {CONTRACT_FIELDS.map((field) => (
              <div key={field.field} className="adapter-contract-row">
                <span className="adapter-contract-field">{field.field}</span>
                <span className="adapter-contract-type">{field.type}</span>
                <span className="adapter-contract-desc">{field.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdaptersPane({ adapters, printers }: { adapters: AdapterInfo[]; printers: Printer[] }) {
  const { t } = useI18n()
  function jinniPrinterFor(adapterId: string): Printer | undefined {
    return printers.find((printer) => printer.adapter === adapterId && printer.status === 'managed' && Boolean(printer.jinniVersion))
  }

  return (
    <>
      <div className="set-pane-intro">
        {t('adapters.intro')}
      </div>

      <Group title={t('adapters.installed')}>
        {adapters.length === 0 && <div className="set-empty">{t('adapters.none')}</div>}
        {adapters.map((adapter) => (
          <AdapterCard key={adapter.id} adapter={adapter} jinniPrinter={jinniPrinterFor(adapter.id)} />
        ))}
      </Group>

      <Group title={t('adapters.dev_reference')}>
        <div className="adapter-contract-wrap">
          <InterfaceContract />
        </div>
      </Group>
    </>
  )
}
