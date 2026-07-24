import { useState } from 'react'
import { IconCode, IconInfo } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import type { TFunction } from '../../../i18n'
import { highlightCode } from './shared'
import { HighlightedCode } from './highlighted-code'

const GCODE_HELP_KEYS: Record<string, string> = {
  G0: 'gcode_g0', G1: 'gcode_g1', G4: 'gcode_g4',
  G90: 'gcode_g90', G91: 'gcode_g91', G92: 'gcode_g92',
  M82: 'gcode_m82', M83: 'gcode_m83', M84: 'gcode_m84',
  M104: 'gcode_m104', M109: 'gcode_m109',
  M140: 'gcode_m140', M190: 'gcode_m190',
  M300: 'gcode_m300', RESPOND: 'gcode_respond', PARK: 'gcode_park',
  SET_GCODE_OFFSET: 'gcode_set_offset',
}

function moveExtra(line: string, t: TFunction): string {
  const axes = [
    /\bZ/.test(line) ? t('create.code.axis_z') : '',
    /\bX/.test(line) || /\bY/.test(line) ? t('create.code.axis_xy') : '',
    /\bE/.test(line) ? t('create.code.axis_e') : '',
  ].filter(Boolean)

  return axes.length ? ' ' + axes.join(', ') + '.' : '.'
}

export function explainLine(raw: string, t: TFunction): string | null {
  const line = raw.trim()
  const macroMatch = /\[gcode_macro\s+(\S+)\]/.exec(line)
  const setDefault = /\{%\s*set\s+(\w+)\s*=\s*params\.(\w+)\|default\(([^)]*)\)/.exec(line)
  const command = line.split(/\s+/)[0]
  if (line === '') return null
  if (line.startsWith('[')) return macroMatch ? t('create.code.defines_macro', { name: macroMatch[1] }) : t('create.code.starts_section')
  if (/^description:/.test(line)) return t('create.code.description')
  if (/^gcode:/.test(line)) return t('create.code.gcode_body')
  if (setDefault) return t('create.code.read_option', { option: setDefault[2], def: setDefault[3], target: setDefault[1] })
  if (/\{%\s*set\s+\w+/.test(line)) return t('create.code.set_value')
  if (/\{%\s*for\b/.test(line)) return t('create.code.for')
  if (/\{%\s*endfor/.test(line)) return t('create.code.endfor')
  if (/\{%\s*if\b/.test(line)) return t('create.code.if')
  if (/\{%\s*else/.test(line)) return t('create.code.else')
  if (/\{%\s*endif/.test(line)) return t('create.code.endif')
  if (GCODE_HELP_KEYS[command]) return t('create.code.' + GCODE_HELP_KEYS[command]) + (command === 'G1' || command === 'G0' ? moveExtra(line, t) : '.')

  return null
}

function ExplainRow({ line }: { line: string }) {
  const { t } = useI18n()
  const note = explainLine(line, t)
  const blank = line.trim() === ''

  return (
    <div className={'ce-ex-row' + (blank ? ' blank' : '')}>
      <div className="ce-ex-code">{blank ? '​' : highlightCode(line)}</div>
      <div className="ce-ex-note">{note && <span>{note}</span>}</div>
    </div>
  )
}

// A read-only g-code view with an Explain toggle (plain-language note per line).
export function GcodeView({ code, filename }: { code: string; filename: string }) {
  const { t } = useI18n()
  const [explain, setExplain] = useState(false)

  return (
    <div className="ce">
      <div className="ce-bar">
        <div className="ce-bar-left">
          <span className="ce-dot"><IconCode size={13} /></span>
          <span className="ce-filename">{filename}</span>
          <span className="ce-lang">{t('create.code.lang')}</span>
        </div>
        <div className="ce-bar-right">
          <button className={'ce-explain-toggle' + (explain ? ' on' : '')} onClick={() => setExplain(!explain)} title={t('create.code.explain_title')}>
            <IconInfo size={13} /> {t('create.code.explain')}
          </button>
        </div>
      </div>
      {explain ? (
        <div className="ce-explain-view">{code.split('\n').map((line, index) => <ExplainRow key={index} line={line} />)}</div>
      ) : (
        <div className="u-p-3"><HighlightedCode code={code} /></div>
      )}
    </div>
  )
}
