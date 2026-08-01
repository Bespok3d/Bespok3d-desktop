// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import cx from '../../../../utils/cx'
import { Group } from '../../../common/Group'
import { Toggle } from '../../../common/Toggle'
import { IconCheck, IconGlobe, IconEdit, IconDownload } from '../../../../design-system/icons'
import { LOCALES, LOCALE_DATA, detectSystemLocale, localeProgress } from '../../../../i18n'
import { useI18n } from '../../../../i18n/context'
import { downloadJson } from '../../../../utils/download'
import { TranslationEditor } from './TranslationEditor'
import type { Locale } from '../../../../i18n'
import './language.css'

export { RegionFormatsGroup } from './region-formats-group'

interface LocaleSettings {
  locale: string
  firstDayOfWeek: 'auto' | 'mon' | 'sun'
  units: 'metric' | 'imperial'
}

interface LanguagePaneProps {
  settings: LocaleSettings
  onChange: (s: LocaleSettings) => void
}

// Translation-completeness color: near-complete is ok-green, partial is the accent, sparse is warn.
function ringColor(pct: number): string {
  if (pct >= 95) return 'var(--ok-fg)'
  if (pct >= 60) return 'var(--accent)'

  return 'var(--warn-fg)'
}

function ProgressRing({ pct, size = 22 }: { pct: number; size?: number }) {
  const radius = size / 2 - 2
  const circumference = 2 * Math.PI * radius
  const dash = (pct / 100) * circumference
  const color = ringColor(pct)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-sunken)" strokeWidth="3" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={`${dash} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}

const FLAG_BG: Record<string, string> = {
  en: [
    'linear-gradient(transparent 41%, #C8102E 41% 59%, transparent 59%)',
    'linear-gradient(90deg, transparent 41%, #C8102E 41% 59%, transparent 59%)',
    'linear-gradient(45deg, transparent 44%, #C8102E 44% 56%, transparent 56%)',
    'linear-gradient(-45deg, transparent 44%, #C8102E 44% 56%, transparent 56%)',
    'linear-gradient(transparent 35%, #fff 35% 65%, transparent 65%)',
    'linear-gradient(90deg, transparent 35%, #fff 35% 65%, transparent 65%)',
    'linear-gradient(45deg, transparent 39%, #fff 39% 61%, transparent 61%)',
    'linear-gradient(-45deg, transparent 39%, #fff 39% 61%, transparent 61%)',
    '#012169',
  ].join(', '),
  fr:    'linear-gradient(90deg, #002395 33.3%, #fff 33.3% 66.7%, #ED2939 66.7%)',
  de:    'linear-gradient(#000 33.3%, #DD0000 33.3% 66.7%, #FFCE00 66.7%)',
  es:    'linear-gradient(#AA151B 25%, #F1BF00 25% 75%, #AA151B 75%)',
  ja:    'radial-gradient(circle, #BC002D 33%, #fff 33%)',
  'zh-CN': '#DE2910',
  'pt-BR': 'linear-gradient(150deg, #009C3B 45%, #FFDF00 45% 55%, #009C3B 55%)',
  it:    'linear-gradient(90deg, #009246 33.3%, #fff 33.3% 66.7%, #CE2B37 66.7%)',
  ko:    'radial-gradient(circle at 50% 50%, #C60C30 0% 35%, #003478 35% 70%, transparent 70%), white',
  tr:    [
    'radial-gradient(circle at 48% 50%, #E30A17 26%, transparent 26%)',
    'radial-gradient(circle at 38% 50%, #fff 28%, transparent 28%)',
    '#E30A17',
  ].join(', '),
}

function LocaleFlag({ code, size = 28 }: { code: string; size?: number }) {
  return (
    <span className="locale-flag" style={{ width: size, height: size, background: FLAG_BG[code] ?? 'var(--ink-3)' }} />
  )
}

function LocaleList({ locales, effectiveCode, useSystem, onPick, onEdit, onDownload }: {
  locales: Locale[]; effectiveCode: string; useSystem: boolean
  onPick: (code: string) => void; onEdit: (code: string) => void; onDownload: (code: string) => void
}) {
  return (
    <div className="locale-list locale-list-divided">
      {locales.map((loc) => {
        const active = effectiveCode === loc.code

        return (
          <div key={loc.code} className={cx('locale-row', active && 'active')}>
            <button className="locale-row-main" onClick={() => onPick(loc.code)} disabled={useSystem && !active}>
              <LocaleFlag code={loc.code} size={28} />
              <div className="locale-text">
                <div className="locale-native">{loc.nativeName}</div>
                <div className="locale-en mono">{loc.name} · {loc.code}</div>
              </div>
              <div className="locale-progress">
                <ProgressRing pct={localeProgress(loc.code)} size={22} />
                <span className="locale-progress-pct mono">{localeProgress(loc.code)}%</span>
              </div>
              {active && <IconCheck size={16} className="u-accent u-shrink-0" />}
            </button>
            <div className="locale-row-actions">
              <button className="locale-action-btn" onClick={() => onDownload(loc.code)} title={`Download ${loc.code}.json`}>
                <IconDownload size={13} />
              </button>
              <button className="locale-action-btn" onClick={() => onEdit(loc.code)} title={`Edit ${loc.name}`}>
                <IconEdit size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LanguagePane({ settings, onChange }: LanguagePaneProps) {
  const { t, setLocale, customLocales } = useI18n()
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const systemCode = detectSystemLocale()
  const useSystem = settings.locale === 'system'
  const effectiveCode = useSystem ? systemCode : settings.locale

  function handleUseSystem(checked: boolean) {
    const newLocale = checked ? 'system' : effectiveCode
    onChange({ ...settings, locale: newLocale })
    setLocale(newLocale)
  }

  function handlePickLocale(code: string) {
    onChange({ ...settings, locale: code })
    setLocale(code)
  }

  function handleDownloadLocale(code: string) {
    const merged = { ...(LOCALE_DATA[code] ?? {}), ...(customLocales[code] ?? {}) }
    downloadJson(`${code}.json`, merged)
  }

  return (
    <>
      <Group title={t('lang.display_language')}>
        <div className="set-row set-row-centered">
          <div className="set-row-text">
            <div className="set-row-label">{t('lang.use_system')}</div>
            <div className="set-row-hint">
              {t('lang.system_currently', { name: LOCALES.find((loc) => loc.code === systemCode)?.nativeName ?? 'English' })}{' '}
              <span className="locale-system-code">({systemCode})</span>
            </div>
          </div>
          <div className="set-row-control">
            <Toggle on={useSystem} onChange={handleUseSystem} />
          </div>
        </div>
        <LocaleList
          locales={LOCALES} effectiveCode={effectiveCode} useSystem={useSystem}
          onPick={handlePickLocale} onEdit={setEditingCode} onDownload={handleDownloadLocale}
        />
      </Group>

      <Group title={t('lang.help_translate')}>
        <div className="set-row set-row-top">
          <div className="key-icon u-shrink-0" data-kind="package">
            <IconGlobe size={16} />
          </div>
          <div className="set-row-text u-flex-1">
            <div className="set-row-label">{t('lang.contribute_title')}</div>
            <div className="set-row-hint">{t('lang.contribute_hint')}</div>
          </div>
        </div>
      </Group>

      {editingCode && <TranslationEditor code={editingCode} onClose={() => setEditingCode(null)} />}
    </>
  )
}

export function makeDefaultLocaleSettings(): LocaleSettings {
  return { locale: 'system', firstDayOfWeek: 'auto', units: 'metric' }
}

export type { LocaleSettings }
