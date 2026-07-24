import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { statusLabel } from '../status-presentation'
import { statusDotClass, updateCallout } from '../../../data/printers'
import { PrinterAvatar } from '../PrinterAvatar'
import { PrinterUpdateCallout } from '../../PrinterUpdateCallout'
import { usePrinterUpdates } from './usePrinterUpdates'
import { PrinterIdentity } from './identity'
import { useHoverIntent } from '../../common/hooks/useHoverIntent'
import { IconCheck } from '../../../design-system/icons'
import type { Printer } from '../../../data/types'

const FLYOUT_CLOSE_GRACE_MS = 200

interface PrinterMenuItemProps {
  printer: Printer
  adapterIcon?: string
  adapterJinniVersion?: string
  isSelected: boolean
  onSelect: () => void
  onUpdateDaemon: () => void
  onUpdateJinni: () => void
}

// The hover sub-flyout listing a printer's web endpoints (Fluidd/Mainsail/...). Private to the row: it
// is the row's hover detail. Opening a link must not bubble to the row's onSelect, hence stopPropagation.
function EndpointsFlyout({ endpoints, onEnter, onLeave }: {
  endpoints: Array<{ label: string; url: string }>
  onEnter: () => void
  onLeave: () => void
}) {
  return (
    <div className="endpoints-flyout" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {endpoints.map((endpoint) => (
        <button
          key={endpoint.url}
          className="endpoint-item"
          onClick={(event) => { event.stopPropagation(); void window.b3d.openUrl(endpoint.url) }}
        >
          {endpoint.label}
        </button>
      ))}
    </div>
  )
}

// Hidden unless the printer answers on a network beyond the primary one (Wi-Fi + Ethernet, or a VPN).
// The primary ip already shows in the meta line, so this lists only the OTHER interfaces, each labelled
// with its kind, so the extra addresses are not a mystery and the primary is never repeated.
function RowInterfaces({ printer }: { printer: Printer }) {
  const { t } = useI18n()
  const additional = (printer.networkInterfaces ?? []).filter((iface) => iface.ip !== printer.ip)
  if (additional.length === 0) return null

  return (
    <div className="printer-ifaces">
      <span className="printer-ifaces-label">{t('printers.other_interfaces')}</span>
      {additional.map((iface) => (
        <span key={iface.ip} className="printer-iface">{iface.label ? `${iface.label} ${iface.ip}` : iface.ip}</span>
      ))}
    </div>
  )
}

function RowVersions({ printer }: { printer: Printer }) {
  const { t } = useI18n()
  const jinni = printer.jinniVersion && printer.jinniVersion !== 'unknown' ? printer.jinniVersion : undefined
  if (!printer.daemonVersion && !jinni) return null

  return (
    <div className="printer-versions-line">
      {printer.daemonVersion && <span className="u-nowrap">{t('printers.daemon_version', { version: printer.daemonVersion })}</span>}
      {printer.daemonVersion && jinni && <span> · </span>}
      {jinni && <span className="u-nowrap">{t('printers.jinni_version', { version: jinni })}</span>}
    </div>
  )
}

function RowInfo({ printer }: { printer: Printer }) {
  return (
    <div className="printer-info">
      <PrinterIdentity printer={printer} />
      <RowInterfaces printer={printer} />
      <RowVersions printer={printer} />
    </div>
  )
}

// One printer row: avatar + name/ip/count/interfaces/versions, an up-to-date check when current, the
// hover-revealed endpoints flyout, and an optional update callout. The update strip is a sibling of the
// selection button (never nested inside it) so the two interactive targets stay separate.
export function PrinterMenuItem({ printer, adapterIcon, adapterJinniVersion, isSelected, onSelect, onUpdateDaemon, onUpdateJinni }: PrinterMenuItemProps) {
  const { t } = useI18n()
  const endpoints = useHoverIntent(FLYOUT_CLOSE_GRACE_MS)
  const { pluginUpdates } = usePrinterUpdates(printer)
  const callout = updateCallout(printer, adapterJinniVersion)
  const upToDate = isSelected && pluginUpdates === 0 && !callout

  return (
    <div className={cx('printer-row-wrap', isSelected && 'active', callout && 'has-update', (callout === 'daemon' || callout === 'both') && 'daemon', callout === 'jinni' && 'jinni', callout === 'both' && 'both')}>
      <div className="printer-row-top">
        <button className="printer-row" onClick={onSelect}>
          <PrinterAvatar
            printer={printer}
            adapterIcon={adapterIcon}
            dotClass={statusDotClass(printer)}
            dotTitle={statusLabel(printer, false, t)}
          />
          <RowInfo printer={printer} />
          {upToDate && <IconCheck size={16} className="u-accent u-shrink-0" />}
        </button>
        {printer.endpoints && printer.endpoints.length > 0 && (
          <div className="endpoints-zone" onMouseEnter={endpoints.open} onMouseLeave={endpoints.scheduleClose}>
            <span className="endpoints-chevron">›</span>
            {endpoints.active && (
              <EndpointsFlyout endpoints={printer.endpoints} onEnter={endpoints.open} onLeave={endpoints.scheduleClose} />
            )}
          </div>
        )}
      </div>
      {callout && (
        <PrinterUpdateCallout kind={callout} adapterJinniVersion={adapterJinniVersion} onUpdateDaemon={onUpdateDaemon} onUpdateJinni={onUpdateJinni} />
      )}
    </div>
  )
}
