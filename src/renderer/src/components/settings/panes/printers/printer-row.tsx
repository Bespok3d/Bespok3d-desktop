// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../../../utils/cx'
import { IconTrash, IconPrinter } from '../../../../design-system/icons'
import { EditableIcon } from '../../../common/editable-icon'
import { Row } from '../../../common/Row'
import { Button } from '../../../common/Button'
import { Toggle } from '../../../common/Toggle'
import { JinniCaution } from '../../JinniCaution'
import { PrinterUpdateCallout } from '../../../PrinterUpdateCallout'
import { PrinterForceMenu } from './PrinterForceMenu'
import type { PrinterForceActions } from './PrinterForceMenu'
import { PrinterDeployMenu } from './PrinterDeployMenu'
import type { Printer } from '../../../../data/types'
import { statusDotClass, updateCallout, printerAdapter } from '../../../../data/printers'
import { formatDateTime } from '../../../../utils/datetime'
import { useI18n } from '../../../../i18n/context'
import './printers.css'

export type PrinterPrimaryAction = 'enroll' | 'repair' | 'manage' | 'reactivate' | 'none'

// An online printer that was already enrolled is not a candidate for enrollment: its daemon is just
// unreachable right now, so it gets Repair (the lightweight redeploy that keeps the pinned cert/token),
// mirroring the main-window repair banner. Enroll is reserved for a printer never enrolled.
export function printerPrimaryAction(printer: Printer): PrinterPrimaryAction {
  if (printer.status === 'deactivated') return 'reactivate'
  if (printer.status === 'managed') return 'manage'
  if (printer.status !== 'online') return 'none'

  return printer.enrollmentLog ? 'repair' : 'enroll'
}

interface PrinterRowProps {
  printer: Printer
  adapters: AdapterInfo[]
  onRemovePrinter: (id: string) => void
  onUpdatePrinterIcon: (id: string, color?: string, image?: string, size?: number) => void
  onEnrollPrinter: (id: string) => void
  onRepair: (id: string) => void
  onRecover: (id: string) => void
  onReinstall: (id: string) => void
  onViewEnrollmentLog: (id: string) => void
  onUpdateDaemon: (id: string) => void
  onUpdateJinni: (id: string) => void
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
  onUninstall: (id: string) => void
  onSetCustomSshCredentials: (id: string, value: boolean) => void
}

function PrinterRowAvatar({ printer, adapters, onUpdatePrinterIcon }: Pick<PrinterRowProps, 'printer' | 'adapters' | 'onUpdatePrinterIcon'>) {
  return (
    <div className="u-relative u-inline-flex u-shrink-0">
      <EditableIcon
        defaultIcon={IconPrinter}
        color={printer.iconColor}
        image={printer.iconImage}
        fallbackImage={printerAdapter(adapters, printer)?.icon}
        features={['color', 'image']}
        minSize={32}
        maxSize={32}
        onColorChange={(color) => onUpdatePrinterIcon(printer.id, color, printer.iconImage, printer.iconSize)}
        onImageChange={(image) => onUpdatePrinterIcon(printer.id, printer.iconColor, image, printer.iconSize)}
      />
      <span className={cx('status-dot', 'printer-status-badge', statusDotClass(printer))} />
    </div>
  )
}

function PrinterDates({ printer, onViewEnrollmentLog }: { printer: Printer; onViewEnrollmentLog: (id: string) => void }) {
  const { t } = useI18n()

  return (
    <>
      {printer.enrollmentLog && (
        <button className="enroll-log-link" onClick={() => onViewEnrollmentLog(printer.id)}>
          {t('printers.enrolled')} {formatDateTime(printer.enrollmentLog.enrolledAt)}
        </button>
      )}
      {printer.daemonUpdatedAt && <div className="u-hint">{t('printers.daemon_updated')} {formatDateTime(printer.daemonUpdatedAt)}</div>}
      {printer.deactivatedAt && <div className="u-hint">{t('printers.deactivated_at')} {formatDateTime(printer.deactivatedAt)}</div>}
    </>
  )
}

// The mono identity lines under the printer name: ip + adapter version, then the daemon + jinni
// versions, then the enrollment / last-update dates. jinni "unknown" (daemon too old to report it) is
// hidden rather than shown as a non-version.
function PrinterInfoLines({ printer, adapters, onViewEnrollmentLog }: Pick<PrinterRowProps, 'printer' | 'adapters' | 'onViewEnrollmentLog'>) {
  const { t } = useI18n()
  const adapterVersion = printerAdapter(adapters, printer)?.version
  const jinni = printer.jinniVersion && printer.jinniVersion !== 'unknown' ? printer.jinniVersion : undefined

  return (
    <>
      <div className="set-row-hint mono">
        {printer.ip}
        {adapterVersion && ` · ${t('printers.adapter_version', { version: adapterVersion })}`}
      </div>
      {(printer.daemonVersion || jinni) && (
        <div className="set-row-hint mono">
          {printer.daemonVersion && t('printers.daemon_version', { version: printer.daemonVersion })}
          {printer.daemonVersion && jinni && ' · '}
          {jinni && t('printers.jinni_version', { version: jinni })}
        </div>
      )}
      <PrinterDates printer={printer} onViewEnrollmentLog={onViewEnrollmentLog} />
    </>
  )
}

// A deactivated printer carries few actions, so it reads as a half-empty row. A prominent banner fills
// that space and states the dormant status plainly, with Reactivate sitting in the actions row below.
function PrinterDeactivatedBanner({ printer }: { printer: Printer }) {
  const { t } = useI18n()
  if (printer.status !== 'deactivated') return null

  return (
    <div className="printer-deactivated-banner">
      <span className="printer-deactivated-title">{t('printers.deactivated_at')}</span>
      <span className="printer-deactivated-hint">{t('printers.deactivated_hint')}</span>
    </div>
  )
}

function PrinterSshPref({ printer, onSetCustomSshCredentials }: Pick<PrinterRowProps, 'printer' | 'onSetCustomSshCredentials'>) {
  const { t } = useI18n()

  return (
    <div className="printer-ssh-pref">
      <span>
        <span className="printer-ssh-pref-label">{t('printers.custom_ssh')}</span>
        <span className="printer-ssh-pref-hint">{t('printers.custom_ssh_hint')}</span>
      </span>
      <Toggle on={Boolean(printer.customSshCredentials)} onChange={(checked) => onSetCustomSshCredentials(printer.id, checked)} />
    </div>
  )
}

type PrinterActionsRowProps = Pick<PrinterRowProps, 'printer' | 'adapters' | 'onEnrollPrinter' | 'onRepair' | 'onRecover' | 'onReinstall' | 'onUpdateDaemon' | 'onUpdateJinni' | 'onDeactivate' | 'onReactivate' | 'onUninstall'>

function PrinterActionsRow({ printer, adapters, onEnrollPrinter, onRepair, onRecover, onReinstall, onUpdateDaemon, onUpdateJinni, onDeactivate, onReactivate, onUninstall }: PrinterActionsRowProps) {
  const { t } = useI18n()
  const action = printerPrimaryAction(printer)
  const forceActions: PrinterForceActions = { onEnroll: onEnrollPrinter, onRecover, onRepair, onReinstall }
  const adapterJinni = printerAdapter(adapters, printer)?.jinniVersion
  const callout = updateCallout(printer, adapterJinni)
  // The Force flows all run an SSH op, so they are pointless on an offline printer that cannot be
  // reached; hide the menu there (the primary action is already hidden for offline).
  const showForce = Boolean(printer.enrollmentLog) && printer.status !== 'offline'

  return (
    <>
      {callout && <PrinterUpdateCallout kind={callout} adapterJinniVersion={adapterJinni} onUpdateDaemon={() => onUpdateDaemon(printer.id)} onUpdateJinni={() => onUpdateJinni(printer.id)} />}
      <div className="printer-row-actions">
        {action === 'enroll' && <Button variant="primary" size="sm" className="enroll-cta" onClick={() => onEnrollPrinter(printer.id)}>{t('printers.enroll')}</Button>}
        {action === 'repair' && <Button variant="primary" size="sm" onClick={() => onRepair(printer.id)}>{t('printers.repair')}</Button>}
        {action === 'reactivate' && <Button variant="primary" size="sm" onClick={() => onReactivate(printer.id)}>{t('printers.reactivate')}</Button>}
        {action === 'manage' && (
          <>
            <PrinterDeployMenu printerId={printer.id} updatePending={Boolean(callout)} actions={{ onUpdateDaemon, onUpdateJinni }} />
            <Button variant="outline" size="sm" onClick={() => onDeactivate(printer.id)}>{t('printers.deactivate')}</Button>
            <Button variant="danger" size="sm" onClick={() => onUninstall(printer.id)}>{t('printers.uninstall')}</Button>
          </>
        )}
        {showForce && <PrinterForceMenu printerId={printer.id} actions={forceActions} />}
      </div>
    </>
  )
}

export function PrinterRow(props: PrinterRowProps) {
  const { printer, adapters, onRemovePrinter, onUpdatePrinterIcon, onViewEnrollmentLog, onSetCustomSshCredentials } = props
  const { t } = useI18n()

  return (
    <Row className="printer-row" icon={<PrinterRowAvatar printer={printer} adapters={adapters} onUpdatePrinterIcon={onUpdatePrinterIcon} />}>
      <div className="printer-row-head">
        <div className="set-row-label">
          {printer.nick}
          <span className="printer-adapter-suffix"> · {printerAdapter(adapters, printer)?.title ?? printer.adapter}</span>
        </div>
        <Button variant="ghost" size="sm" icon title={t('printers.remove')} onClick={() => onRemovePrinter(printer.id)} className="u-ml-auto">
          <IconTrash size={16} />
        </Button>
      </div>
      <PrinterInfoLines printer={printer} adapters={adapters} onViewEnrollmentLog={onViewEnrollmentLog} />
      <PrinterDeactivatedBanner printer={printer} />
      <PrinterActionsRow
        printer={printer}
        adapters={adapters}
        onEnrollPrinter={props.onEnrollPrinter}
        onRepair={props.onRepair}
        onRecover={props.onRecover}
        onReinstall={props.onReinstall}
        onUpdateDaemon={props.onUpdateDaemon}
        onUpdateJinni={props.onUpdateJinni}
        onDeactivate={props.onDeactivate}
        onReactivate={props.onReactivate}
        onUninstall={props.onUninstall}
      />
      <PrinterSshPref printer={printer} onSetCustomSshCredentials={onSetCustomSshCredentials} />
      <JinniCaution extras={printer.jinniExtras ?? []} />
    </Row>
  )
}
