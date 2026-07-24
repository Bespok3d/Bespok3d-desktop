import type { Printer } from '../../data/types'
import { IconBolt, IconPrinter, IconDownload, IconArrow } from '../../design-system/icons'
import { Button } from '../common/Button'
import { useI18n } from '../../i18n/context'
import { SAVED_MACROS, MACRO_LIBRARY, type SavedMacro } from './create-data'
import { StarterCard } from './starter-card'

function fromLabel(starterId: string | null): string | null {
  if (!starterId) return null

  return MACRO_LIBRARY.find((entry) => entry.id === starterId)?.title ?? null
}

function SavedRow({ saved, printer, onOpenWorkbench }: { saved: SavedMacro; printer: Printer; onOpenWorkbench: () => void }) {
  const { t } = useI18n()
  const origin = fromLabel(saved.fromLibrary)
  const printerCount = saved.installedOn.length

  return (
    <div className="lib-row">
      <span className="lib-row-ic"><IconBolt size={16} /></span>
      <div className="lib-row-text">
        <div className="lib-row-title">{saved.title}{origin && <span className="lib-tag">{t('create.lib.from_origin', { origin })}</span>}</div>
        <div className="lib-row-blurb">{saved.blurb}</div>
        <div className="lib-row-meta">
          <span><IconPrinter size={11} /> {t('create.lib.on_printers', { count: printerCount })}</span>
          <span>·</span><span>{t('create.lib.updated', { date: saved.updatedAt })}</span>
        </div>
      </div>
      <div className="lib-row-actions">
        <Button variant="outline" size="sm" disabled><IconDownload size={13} /> {t('create.lib.add_to', { printer: printer.nick.split(' ')[0] })}</Button>
        <Button variant="ghost" size="sm" onClick={onOpenWorkbench}>{t('create.lib.open_workbench')} <IconArrow size={12} /></Button>
      </div>
    </div>
  )
}

export function LibrarySurface({ printer, onOpenWorkbench, onGoMacros }: { printer: Printer; onOpenWorkbench: () => void; onGoMacros: () => void }) {
  const { t } = useI18n()

  return (
    <div className="create-pane">
      <div className="cp-head">
        <div className="cp-eyebrow">{t('create.lib.eyebrow')}</div>
        <h1 className="cp-title">{t('create.lib.title')}</h1>
        <p className="cp-sub">{t('create.lib.sub')}</p>
      </div>
      <div className="lib-section">
        <div className="lib-section-head"><h3>{t('create.lib.saved_by_you')}</h3><span className="lib-count">{SAVED_MACROS.length}</span></div>
        <div className="lib-rows">
          {SAVED_MACROS.map((saved) => <SavedRow key={saved.id} saved={saved} printer={printer} onOpenWorkbench={onOpenWorkbench} />)}
        </div>
      </div>
      <div className="lib-section">
        <div className="lib-section-head"><h3>{t('create.lib.starters')}</h3><span className="lib-count">{MACRO_LIBRARY.length}</span><span className="lib-section-note">{t('create.lib.starters_note')}</span></div>
        <div className="mk-lib-grid">{MACRO_LIBRARY.map((starter) => <StarterCard key={starter.id} starter={starter} onPick={onGoMacros} />)}</div>
      </div>
    </div>
  )
}
