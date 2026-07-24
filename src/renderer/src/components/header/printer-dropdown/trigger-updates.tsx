import { useI18n } from '../../../i18n/context'
import { useUpdateFlags } from './usePrinterUpdates'
import { IconArrowUp } from '../../../design-system/icons'
import type { Printer } from '../../../data/types'

type UpdateTone = 'daemon' | 'jinni' | 'plugin'

const BADGE_CLASS: Record<UpdateTone, string> = {
  daemon: 'update-badge daemon',
  jinni: 'update-badge jinni',
  plugin: 'update-badge plugin',
}

function Badge({ tone, title, children }: { tone: UpdateTone; title: string; children: string }) {
  return <span className={BADGE_CLASS[tone]} title={title}><IconArrowUp size={10} />{children}</span>
}

// The closed trigger's compact attention badges: an amber daemon badge, a sage adapter (jinni) badge,
// and the plugin-update count. Managed-gated via useUpdateFlags so an offline printer wears none. The
// closed state shows only these badges; the full "X available" wording lives in the open rows.
export function TriggerUpdates({ printer, adapterJinniVersion }: { printer: Printer; adapterJinniVersion?: string }) {
  const { t } = useI18n()
  const { daemon, jinni, pluginUpdates } = useUpdateFlags(printer, adapterJinniVersion)

  return (
    <>
      {daemon && <Badge tone="daemon" title={t('printers.daemon_update', { version: window.b3d.daemonExpectedVersion })}>{t('printers.daemon_badge')}</Badge>}
      {jinni && <Badge tone="jinni" title={t('printers.jinni_update', { version: adapterJinniVersion ?? '' })}>{t('printers.jinni_badge')}</Badge>}
      {pluginUpdates > 0 && <Badge tone="plugin" title={t('printers.plugin_updates', { count: pluginUpdates })}>{String(pluginUpdates)}</Badge>}
    </>
  )
}
