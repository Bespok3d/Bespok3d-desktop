// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { Printer } from '../../data/types'
import cx from '../../utils/cx'
import { useI18n } from '../../i18n/context'
import type { TFunction } from '../../i18n'
import { Button } from '../common/Button'
import {
  IconShield,
  IconChip, IconChevron, IconCheck, IconClose, IconAlert, IconShieldCheck, IconEdit, IconBolt,
  IconBox, IconCheckCircle, IconArrowUp, IconDownload, IconRefresh, IconPlus, IconSpool,
  type IconProps,
} from '../../design-system/icons'
import {
  WORKBENCH_DRAFTS, WORKBENCH_SECTIONS, COACH_CHECKS, AUTHORING_OPS,
  type WorkbenchDraft, type BuildState, type CoachCheck,
} from './create-data'
import {
  FilesSection, VariablesSection, ServicesSection, ManagedSection, InstrumentSection,
  MetadataSection, PermissionsSection,
} from './sections'
import { CREATE_ICONS } from './icon-registry'

type WorkbenchLayout = 'A' | 'B'

const BUILD_META: Record<BuildState, { labelKey: string; tone: string; icon: ComponentType<IconProps> }> = {
  dirty: { labelKey: 'create.wb.state_dirty', tone: 'warn', icon: IconEdit },
  building: { labelKey: 'create.wb.state_building', tone: 'info', icon: IconBolt },
  'build-failed': { labelKey: 'create.wb.state_build_failed', tone: 'err', icon: IconAlert },
  built: { labelKey: 'create.wb.state_built', tone: 'accent', icon: IconBox },
  installing: { labelKey: 'create.wb.state_installing', tone: 'info', icon: IconBolt },
  installed: { labelKey: 'create.wb.state_installed', tone: 'ok', icon: IconCheckCircle },
  'out-of-date': { labelKey: 'create.wb.state_out_of_date', tone: 'warn', icon: IconArrowUp },
}

function BuildPill({ state }: { state: BuildState }) {
  const { t } = useI18n()
  const meta = BUILD_META[state]
  const Glyph = meta.icon

  return <span className={'wb-build-pill ' + meta.tone}><Glyph size={12} /> {t(meta.labelKey)}</span>
}

function sectionContent(section: string, printer: Printer, draft: WorkbenchDraft, onOpenSnap: () => void): ReactNode {
  if (section === 'variables') return <VariablesSection />
  if (section === 'services') return <ServicesSection printer={printer} />
  if (section === 'managed') return <ManagedSection />
  if (section === 'instrument') return <InstrumentSection onOpenSnap={onOpenSnap} />
  if (section === 'metadata') return <MetadataSection draft={draft} />
  if (section === 'permissions') return <PermissionsSection />

  return <FilesSection />
}

function DraftCard({ draft, onOpen }: { draft: WorkbenchDraft; onOpen: (id: string) => void }) {
  const { t } = useI18n()
  const CategoryGlyph = draft.category === 'filament' ? IconSpool : IconChip

  return (
    <button className="wb-draft-card" onClick={() => onOpen(draft.id)}>
      <div className="wb-draft-top">
        <span className={'card-icon create-icon-38 ' + (draft.category === 'filament' ? 'fil' : 'mac')}><CategoryGlyph /></span>
        <span className={'wb-stage-badge s' + draft.stage}>{t('create.wb.stage', { stage: draft.stage })}</span>
      </div>
      <div className="wb-draft-title">{draft.title} <span className="wb-example-tag">{t('create.wb.example')}</span></div>
      <p className="wb-draft-tag">{draft.tagline}</p>
      <div className="wb-draft-foot">
        <BuildPill state={draft.build} />
        <span className="wb-draft-meta mono">{t('create.wb.version_files', { version: draft.version, count: draft.fileCount })}</span>
      </div>
    </button>
  )
}

function DraftList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t } = useI18n()

  return (
    <div className="create-pane">
      <div className="cp-head">
        <div className="cp-eyebrow">{t('create.wb.plugins_stages')}</div>
        <h1 className="cp-title">{t('create.wb.workbench_title')}</h1>
        <p className="cp-sub">{t('create.wb.workbench_sub')}</p>
      </div>
      <div className="wb-draft-grid">
        <div className="wb-new-card disabled" aria-disabled>
          <span className="wb-new-ic"><IconPlus size={22} /></span>
          <strong>{t('create.wb.new_plugin')}</strong>
          <span>{t('create.wb.new_plugin_hint')}</span>
        </div>
        {WORKBENCH_DRAFTS.map((draft) => <DraftCard key={draft.id} draft={draft} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function checkGlyph(status: string): ReactNode {
  if (status === 'pass') return <IconCheck size={13} />
  if (status === 'warn') return <IconAlert size={13} />

  return <IconClose size={13} />
}

function overallStatus(checks: CoachCheck[]): string {
  if (checks.some((check) => check.status === 'fail')) return 'fail'
  if (checks.some((check) => check.status === 'warn')) return 'warn'

  return 'pass'
}

function CheckRow({ check, onGoto }: { check: CoachCheck; onGoto: (section: string) => void }) {
  return (
    <div className={'wb-check ' + check.status} role="button" tabIndex={0} onClick={() => onGoto(check.section)}>
      <span className="wb-check-ic">{checkGlyph(check.status)}</span>
      <div className="wb-check-text">
        <div className="wb-check-label">{check.label}</div>
        <div className="wb-check-detail">{check.detail}</div>
      </div>
    </div>
  )
}

function coachSummary(t: TFunction, overall: string, fails: number, warns: number): string {
  if (overall === 'pass') return t('create.wb.packaged_ok')
  if (fails) return t('create.wb.to_fix', { count: fails })

  return t('create.wb.to_check', { count: warns })
}

function Coach({ checks, open, onToggle, onGoto }: { checks: CoachCheck[]; open: boolean; onToggle: () => void; onGoto: (section: string) => void }) {
  const { t } = useI18n()
  const overall = overallStatus(checks)
  const fails = checks.filter((check) => check.status === 'fail').length
  const warns = checks.filter((check) => check.status === 'warn').length
  if (!open) {
    return (
      <button className={'wb-coach-collapsed ' + overall} onClick={onToggle} title={t('create.wb.coach')}>
        {overall === 'pass' ? <IconShieldCheck size={16} /> : <IconShield size={16} />}
        <span>{coachSummary(t, overall, fails, warns)}</span>
      </button>
    )
  }

  return (
    <aside className={'wb-coach ' + overall}>
      <div className="wb-coach-head">
        <div className="wb-coach-title">
          {overall === 'pass' ? <IconShieldCheck size={16} /> : <IconShield size={16} />}
          <span>{t('create.wb.packaged_q')}</span>
        </div>
        <Button variant="ghost" size="sm" icon onClick={onToggle} title={t('create.wb.hide')}><IconChevron size={15} /></Button>
      </div>
      <div className="wb-coach-list">{checks.map((check) => <CheckRow key={check.id} check={check} onGoto={onGoto} />)}</div>
      <div className="wb-coach-foot"><span className="op-chip">{AUTHORING_OPS.validate}</span><span>{t('create.wb.runs_on_change')}</span></div>
    </aside>
  )
}

function CoachDrawer({ checks, onGoto }: { checks: CoachCheck[]; onGoto: (section: string) => void }) {
  const { t } = useI18n()
  const fails = checks.filter((check) => check.status === 'fail').length
  const warns = checks.filter((check) => check.status === 'warn').length

  return (
    <div className={'wb-coach-drawer ' + overallStatus(checks)}>
      <span className="wb-coach-drawer-lab"><IconShield size={13} /> {t('create.wb.fix_look', { fails, warns })}</span>
      <span className="wb-pillrow">
        {checks.filter((check) => check.status !== 'pass').map((check) => (
          <button className={'wb-drawer-pill ' + check.status} key={check.id} onClick={() => onGoto(check.section)}>
            <span className="wb-check-ic">{checkGlyph(check.status)}</span> {check.label}
          </button>
        ))}
      </span>
    </div>
  )
}

// Inert in this preview: the actions show the layout but the authoring engine is not wired, so they
// are disabled rather than faking progress.
function BuildBar({ state, printer }: { state: BuildState; printer: Printer }) {
  const { t } = useI18n()
  const meta = BUILD_META[state]
  const Glyph = meta.icon

  return (
    <div className={'wb-buildbar ' + meta.tone}>
      <div className="wb-bb-status">
        <span className={'wb-bb-mark ' + meta.tone}><Glyph size={16} /></span>
        <div className="wb-bb-text">
          <strong>{t(meta.labelKey)}</strong>
          <span>{t('create.wb.buildbar_body', { printer: printer.nick })}</span>
        </div>
      </div>
      <div className="wb-bb-actions">
        <Button variant="primary" disabled><IconBox size={14} /> {t('create.wb.build_b3')}</Button>
        <Button variant="ghost" disabled><IconDownload size={14} /> {t('create.wb.test_on', { printer: printer.nick })}</Button>
        <span className="wb-bb-preview"><IconRefresh size={12} /> {t('create.wb.preview_not_wired')}</span>
      </div>
    </div>
  )
}

function SectionNav({ sections, active, onSelect, checks }: { sections: typeof WORKBENCH_SECTIONS; active: string; onSelect: (id: string) => void; checks: CoachCheck[] }) {
  return (
    <>
      {sections.map((section) => {
        const Glyph = CREATE_ICONS[section.icon] ?? IconChip
        const failHere = checks.some((check) => check.section === section.id && check.status === 'fail')
        const warnHere = checks.some((check) => check.section === section.id && check.status === 'warn')

        return (
          <button key={section.id} className={cx('wb-secnav-item', active === section.id && 'active')} onClick={() => onSelect(section.id)}>
            <span className={'wb-secnav-ic tint-' + section.tint}><Glyph size={13} /></span>
            <span className="wb-secnav-label">{section.label}</span>
            {failHere && <span className="wb-secnav-dot fail" />}
            {!failHere && warnHere && <span className="wb-secnav-dot warn" />}
          </button>
        )
      })}
    </>
  )
}

function DraftHeader({ draft, build, onBack }: { draft: WorkbenchDraft; build: BuildState; onBack: () => void }) {
  const { t } = useI18n()
  const CategoryGlyph = draft.category === 'filament' ? IconSpool : IconChip

  return (
    <div className="wb-top">
      <button className="wb-back" onClick={onBack}><IconChevron size={16} className="wb-back-chevron" /> {t('create.wb.drafts')}</button>
      <span className={'card-icon create-icon-40 ' + (draft.category === 'filament' ? 'fil' : 'mac')}><CategoryGlyph /></span>
      <div className="wb-top-titles">
        <div className="wb-top-title">{draft.title} <span className={'wb-stage-badge s' + draft.stage}>{t('create.wb.stage', { stage: draft.stage })}</span></div>
        <div className="wb-top-sub mono">{draft.name} · v{draft.version}</div>
      </div>
      <span className="u-flex-1" />
      <BuildPill state={build} />
    </div>
  )
}

function WorkbenchOpen({ printer, draft, layout, onBack, onOpenSnap }: { printer: Printer; draft: WorkbenchDraft; layout: WorkbenchLayout; onBack: () => void; onOpenSnap: () => void }) {
  const [section, setSection] = useState('files')
  const [coachOpen, setCoachOpen] = useState(true)
  const build = draft.build
  const nav = <SectionNav sections={WORKBENCH_SECTIONS} active={section} onSelect={setSection} checks={COACH_CHECKS} />
  const content = <div className="wb-main">{sectionContent(section, printer, draft, onOpenSnap)}</div>
  if (layout === 'B') {
    return (
      <div className="wb-open b">
        <DraftHeader draft={draft} build={build} onBack={onBack} />
        <div className="wb-railrow">
          <div className="wb-secnav vertical">{nav}</div>
          {content}
        </div>
        <CoachDrawer checks={COACH_CHECKS} onGoto={setSection} />
        <BuildBar state={build} printer={printer} />
      </div>
    )
  }

  return (
    <div className="wb-open">
      <DraftHeader draft={draft} build={build} onBack={onBack} />
      <div className="wb-secnav">{nav}</div>
      <div className="wb-body">
        {content}
        <Coach checks={COACH_CHECKS} open={coachOpen} onToggle={() => setCoachOpen(!coachOpen)} onGoto={setSection} />
      </div>
      <BuildBar state={build} printer={printer} />
    </div>
  )
}

export function Workbench({ printer, draftId, setDraftId, layout, onOpenSnap }: { printer: Printer; draftId: string | null; setDraftId: (id: string | null) => void; layout: WorkbenchLayout; onOpenSnap: () => void }) {
  if (!draftId) return <DraftList onOpen={setDraftId} />
  const draft = WORKBENCH_DRAFTS.find((entry) => entry.id === draftId) ?? WORKBENCH_DRAFTS[0]

  return <WorkbenchOpen key={draft.id} printer={printer} draft={draft} layout={layout} onBack={() => setDraftId(null)} onOpenSnap={onOpenSnap} />
}
