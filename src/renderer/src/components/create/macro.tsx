import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Printer } from '../../data/types'
import cx from '../../utils/cx'
import { IconPrinter, IconCode, IconChevron, IconDownload, IconInfo, IconLayers, IconArrow } from '../../design-system/icons'
import { MACRO_LIBRARY, AUTHORING_OPS, type MacroTunable } from './create-data'
import { Button } from '../common/Button'
import { useI18n } from '../../i18n/context'
import { GcodeView, HighlightedCode, JsonCode } from './code-view'
import { StarterCard } from './starter-card'

function deriveNames(friendly: string): { macro: string; id: string } {
  const clean = friendly.trim()
  const macro = clean.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'MY_MACRO'
  const id = 'macro-' + (clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my-macro')

  return { macro, id }
}

function retitleBody(body: string, macro: string): string {
  return body.replace(/\[gcode_macro\s+\S+\]/, `[gcode_macro ${macro}]`)
}

function genManifest(spec: { id: string; macro: string; friendly: string; tunables: MacroTunable[] }): string {
  const cfgLines = spec.tunables
    .map((tunable) => `    { "key": "${tunable.key}", "type": "${tunable.type}", "default": ${JSON.stringify(tunable.default)} }`)
    .join(',\n')
  const configBlock = cfgLines ? `,\n  "config": [\n${cfgLines}\n  ]` : ''

  return `{
  "name": "${spec.id}",
  "title": "${spec.friendly}",
  "version": "0.1.0",
  "category": "macros",
  "install": {
    "place": [
      { "class": "klipper-config", "src": "files/${spec.macro.toLowerCase()}.cfg" }
    ]
  }${configBlock}
}`
}

function Reveal({ tier, title, sub, children }: { tier: string; title: string; sub?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cx('mk-reveal', open && 'open')}>
      <button className="mk-reveal-head" onClick={() => setOpen(!open)}>
        <span className={'mk-reveal-tier ' + tier}>{tier}</span>
        <span className="mk-reveal-title">{title} {sub && <span className="sub">· {sub}</span>}</span>
        <span className="chev"><IconChevron size={16} /></span>
      </button>
      {open && <div className="mk-reveal-body">{children}</div>}
    </div>
  )
}

function TunableRow({ tunable }: { tunable: MacroTunable }) {
  return (
    <div className="mk-tunable">
      <div className="mk-tun-text">
        <div className="mk-tun-label">{tunable.label} <span className="mk-tun-key">{tunable.key}</span></div>
        {tunable.hint && <div className="mk-tun-hint">{tunable.hint}</div>}
      </div>
      <div className="mk-tun-ctrl"><span className="val mono">{String(tunable.default)}{tunable.unit ? ' ' + tunable.unit : ''}</span></div>
    </div>
  )
}

function MacroStep({ num, title, hint, children }: { num: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mk-step">
      <div className="mk-step-head">
        <span className="mk-step-num">{num}</span>
        <span className="mk-step-title">{title} {hint && <span className="opt">{hint}</span>}</span>
      </div>
      <div className="mk-step-body">{children}</div>
    </div>
  )
}

export function MacroSurface({ printer, onOpenWorkbench }: { printer: Printer; onOpenWorkbench: () => void }) {
  const { t } = useI18n()
  const [picked, setPicked] = useState(MACRO_LIBRARY[0].id)
  const starter = MACRO_LIBRARY.find((entry) => entry.id === picked) ?? MACRO_LIBRARY[0]
  const { macro, id } = deriveNames(starter.title)
  const genConfig = retitleBody(starter.body, macro)

  return (
    <div className="create-pane">
      <div className="cp-head">
        <div className="cp-eyebrow"><span className="stage-dot">0</span> {t('create.macro.eyebrow')}</div>
        <h1 className="cp-title">{t('create.macro.title')}</h1>
        <p className="cp-sub">{t('create.macro.sub')}</p>
      </div>
      <div className="macro-flow">
        <MacroStep num={1} title={t('create.macro.step1_title')}>
          <div className="mk-lib-grid">
            {MACRO_LIBRARY.map((entry) => (
              <StarterCard key={entry.id} starter={entry} picked={picked === entry.id} onPick={() => setPicked(entry.id)} />
            ))}
          </div>
        </MacroStep>

        <MacroStep num={2} title={t('create.macro.step2_title')}>
          <div className="mk-derived">
            <span className="lbl">{t('create.macro.becomes_command')}</span>
            <span className="val">{macro}</span>
            <span className="lbl">{t('create.macro.plugin_id')}</span>
            <span className="val">{id}</span>
          </div>
        </MacroStep>

        <MacroStep num={3} title={t('create.macro.step3_title')} hint={t('create.macro.step3_hint')}>
          <GcodeView code={starter.body} filename={macro.toLowerCase() + '.cfg'} />
        </MacroStep>

        <div className="mk-summary">
          <span className="ic"><IconInfo size={18} /></span>
          <span className="tx">{t('create.macro.summary_pre')} <strong>{starter.title}</strong>{t('create.macro.summary_to')} <strong>{printer.nick}</strong>. <span className="muted">{t('create.macro.summary_rest')}</span></span>
        </div>

        <Reveal tier="tinkerer" title={t('create.macro.reveal1_title')} sub={t('create.macro.settings_count', { count: starter.tunables.length })}>
          <div className="mk-reveal-stack">
            <div>
              <div className="cp-eyebrow">{t('create.macro.written_to_printer')}</div>
              <div className="ce"><div className="ce-bar"><div className="ce-bar-left"><span className="ce-dot"><IconCode size={13} /></span><span className="ce-filename">files/{macro.toLowerCase()}.cfg</span></div></div>
                <div className="u-p-3"><HighlightedCode code={genConfig} /></div>
              </div>
            </div>
            {starter.tunables.length > 0 && (
              <div>
                <div className="cp-eyebrow">{t('create.macro.tunable_settings')}</div>
                <div className="mk-tunables">{starter.tunables.map((tunable) => <TunableRow key={tunable.key} tunable={tunable} />)}</div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal tier="nerd" title={t('create.macro.reveal2_title')} sub={t('create.macro.one_engine')}>
          <div className="mk-reveal-stack">
            <div className="ce"><div className="ce-bar"><div className="ce-bar-left"><span className="ce-dot"><IconCode size={13} /></span><span className="ce-filename">manifest.json</span></div><span className="ce-lang">{t('create.macro.generated')}</span></div>
              <div className="u-p-3"><JsonCode code={genManifest({ id, macro, friendly: starter.title, tunables: starter.tunables })} /></div>
            </div>
            <div className="mk-summary">
              <span className="ic"><IconLayers size={18} /></span>
              <span className="tx">{t('create.macro.real_plugin_pre')} <strong>{t('create.macro.open_workbench_inline')}</strong> {t('create.macro.real_plugin_post')}
                <div className="mk-summary-action"><Button variant="outline" size="sm" onClick={onOpenWorkbench}><IconArrow size={13} /> {t('create.macro.open_workbench')}</Button></div>
              </span>
            </div>
          </div>
        </Reveal>

        <div className="mk-actions">
          <span className="mk-target"><IconPrinter size={15} /> {t('create.macro.adds_to', { printer: printer.nick })}</span>
          <span className="op-chip">{AUTHORING_OPS.createMacro}</span>
          <span className="grow" />
          <span className="wb-bb-preview"><IconInfo size={12} /> {t('create.macro.preview_note')}</span>
          <Button variant="primary" size="lg" disabled><IconDownload size={16} /> {t('create.macro.add_to_printer')}</Button>
        </div>
      </div>
    </div>
  )
}
