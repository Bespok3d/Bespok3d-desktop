import type { TFunction } from '../../../i18n'
import { useI18n } from '../../../i18n/context'
import { Button } from '../../common/Button'
import { Explainer } from '../../common/content/Explainer'
import { IconDownload } from '../../../design-system/icons'
import type { InstallBlock } from './install-gate'
import type { UsePluginOpsResult } from '../../../hooks/pluginOps'

function installLabel(t: TFunction, switching: boolean, hasUpdate: boolean): string {
  if (switching) return t('btn.switch_version')

  return hasUpdate ? t('btn.update') : t('btn.reinstall')
}

// The single "why is this blocked" surface: the 3-tier Explainer (plain brief + deeper detail), with
// an inline action that walks the user straight to the fix when the block is something they can act on.
function BlockNote({ block, onConfigure }: { block: InstallBlock; onConfigure: () => void }) {
  const { t } = useI18n()

  return (
    <div className="panel-foot-block">
      <Explainer brief={block.brief} detail={block.detail} />
      {block.action === 'configure' && (
        <Button variant="outline" size="sm" onClick={onConfigure}>{t('store.block.configure_action')}</Button>
      )}
    </div>
  )
}

export function PanelFoot({ ops, installed, hasUpdate, switching, canInstall, orphan, dependents, block, printActive, onInstall, onUninstall, onConfigure, onClose }: {
  ops: UsePluginOpsResult; installed: boolean; hasUpdate: boolean; switching: boolean; canInstall: boolean; orphan: boolean
  dependents: string[]; block: InstallBlock | null; printActive: boolean
  onInstall: () => void; onUninstall: () => void; onConfigure: () => void; onClose: () => void
}) {
  const { t } = useI18n()
  // On error the InstallErrorModal owns the whole surface (3-tier headline + technical details +
  // report + retry/close) and covers the panel, so the foot renders nothing.
  if (ops.phase === 'error') return null
  if (ops.phase === 'working') return (
    <div className="panel-foot">
      <Button variant="outline" disabled>{t('btn.close')}</Button>
    </div>
  )

  return (
    <div className="panel-foot">
      {block && <BlockNote block={block} onConfigure={onConfigure} />}
      {!block && installed && dependents.length > 0 && (
        <span className="panel-foot-note">{t('store.removes_dependents', { deps: dependents.join(', ') })}</span>
      )}
      <Button variant="outline" onClick={onClose}>{t('btn.close')}</Button>
      {installed ? (
        <>
          <Button variant="danger" disabled={printActive} onClick={onUninstall}>
            {t('btn.uninstall')}
          </Button>
          {!orphan && (
            <Button variant="primary" disabled={!canInstall} onClick={onInstall}>
              {installLabel(t, switching, hasUpdate)}
            </Button>
          )}
        </>
      ) : (
        <Button variant="primary" disabled={!canInstall} onClick={onInstall}>
          <IconDownload size={14} />
          {t('btn.install')}
        </Button>
      )}
    </div>
  )
}
