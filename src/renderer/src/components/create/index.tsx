// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { ComponentType } from 'react'
import './create.css'
import type { Printer } from '../../data/types'
import cx from '../../utils/cx'
import { useI18n } from '../../i18n/context'
import { IconBolt, IconBox, IconLayers, IconUpload, IconPrinter, IconChip, type IconProps } from '../../design-system/icons'
import { Workbench } from './workbench'
import { MacroSurface } from './macro'
import { LibrarySurface } from './library'
import { PublishSurface } from './publish'
import { WORKBENCH_DRAFTS, DEMO_PATCH_CONFLICT } from './create-data'
import { PatchSnapDialog } from '../dev-tools/PatchSnapDialog'

export { ModeBar } from './mode-bar'

type CreateSurface = 'macros' | 'plugins' | 'library' | 'publish'
type WorkbenchLayout = 'A' | 'B'

interface RailItem {
  id: CreateSurface
  label: string
  glyph: ComponentType<IconProps>
  tint: string
  soon?: boolean
}

const AUTHOR_ITEMS: RailItem[] = [
  { id: 'macros', label: 'Macros', glyph: IconBolt, tint: 'amber', soon: true },
  { id: 'plugins', label: 'Plugins', glyph: IconBox, tint: 'blue' },
]

const YOURS_ITEMS: RailItem[] = [
  { id: 'library', label: 'Library', glyph: IconLayers, tint: 'green', soon: true },
  { id: 'publish', label: 'Publish', glyph: IconUpload, tint: 'rose', soon: true },
]

function RailButton({ item, active, onSelect }: { item: RailItem; active: boolean; onSelect: () => void }) {
  const Glyph = item.glyph

  return (
    <button className={cx('create-nav-item', active && 'active')} onClick={onSelect}>
      <span className={'create-nav-icon tint-' + item.tint}><Glyph size={14} /></span>
      <span className="cn-text">{item.label}</span>
      {item.soon && <span className="cn-soon">soon</span>}
    </button>
  )
}

function CreateRail({ surface, onSelect, printer }: { surface: CreateSurface; onSelect: (surface: CreateSurface) => void; printer: Printer }) {
  const { t } = useI18n()
  function renderItem(item: RailItem) {
    return <RailButton key={item.id} item={item} active={surface === item.id} onSelect={() => onSelect(item.id)} />
  }

  return (
    <aside className="create-rail">
      <div className="create-rail-section">
        <div className="create-rail-label">{t('create.rail_author')}</div>
        {AUTHOR_ITEMS.map(renderItem)}
      </div>
      <div className="create-rail-section">
        <div className="create-rail-label">{t('create.rail_yours')}</div>
        {YOURS_ITEMS.map(renderItem)}
      </div>
      <div className="create-rail-foot">
        <div className="create-printer-target">
          <span className="cpt-av"><IconPrinter size={17} /></span>
          <div className="cpt-text">
            <div className="cpt-label">{t('create.build_test_on')}</div>
            <div className="cpt-name">{printer.nick}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

function LayoutSwitch({ layout, onSetLayout }: { layout: WorkbenchLayout; onSetLayout: (layout: WorkbenchLayout) => void }) {
  const { t } = useI18n()

  return (
    <div className="create-layout-switch">
      <span className="cls-label">{t('create.layout')}</span>
      <div className="segmented sm">
        <button className={cx('seg', layout === 'A' && 'active')} onClick={() => onSetLayout('A')} title={t('labs.layout_a')}>A</button>
        <button className={cx('seg', layout === 'B' && 'active')} onClick={() => onSetLayout('B')} title={t('labs.layout_b')}>B</button>
      </div>
    </div>
  )
}

function NoPrinter() {
  const { t } = useI18n()

  return (
    <div className="create-empty">
      <span className="create-empty-ic"><IconChip size={26} /></span>
      <strong>{t('create.no_printer_title')}</strong>
      <span>{t('create.no_printer_body')}</span>
    </div>
  )
}

export function Create({ printer, layout, onSetLayout }: { printer: Printer | null; layout: WorkbenchLayout; onSetLayout: (layout: WorkbenchLayout) => void }) {
  const { t } = useI18n()
  const [surface, setSurface] = useState<CreateSurface>('plugins')
  const [draftId, setDraftId] = useState<string | null>(WORKBENCH_DRAFTS[0].id)
  const [snapOpen, setSnapOpen] = useState(false)
  function openWorkbench() {
    setDraftId(WORKBENCH_DRAFTS[0].id)
    setSurface('plugins')
  }
  if (!printer) return <NoPrinter />

  return (
    <div className="create">
      <CreateRail surface={surface} onSelect={setSurface} printer={printer} />
      <div className="create-content">
        <div className="create-content-head">
          <span className="create-preview-flag">{t('create.preview_flag')}</span>
          <span className="cch-spacer" />
          {surface === 'plugins' && <LayoutSwitch layout={layout} onSetLayout={onSetLayout} />}
        </div>
        <div className="create-content-body">
          {surface === 'macros' && <MacroSurface printer={printer} onOpenWorkbench={openWorkbench} />}
          {surface === 'plugins' && <Workbench printer={printer} draftId={draftId} setDraftId={setDraftId} layout={layout} onOpenSnap={() => setSnapOpen(true)} />}
          {surface === 'library' && <LibrarySurface printer={printer} onOpenWorkbench={openWorkbench} onGoMacros={() => setSurface('macros')} />}
          {surface === 'publish' && <PublishSurface printer={printer} />}
        </div>
      </div>
      {snapOpen && <PatchSnapDialog conflict={DEMO_PATCH_CONFLICT} onResolved={() => setSnapOpen(false)} onCancel={() => setSnapOpen(false)} />}
    </div>
  )
}
