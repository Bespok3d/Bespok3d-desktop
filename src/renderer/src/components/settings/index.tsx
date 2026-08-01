// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import './settings.css'
import cx from '../../utils/cx'
import { showsUnreleasedFeatures } from '../../utils/unreleased-features'
import { useI18n } from '../../i18n/context'
import { Modal } from '../common/overlay/Modal'
import { IconKey, IconSearch, IconPrinter, IconGitBranch, IconChip, IconSliders, IconGlobe, IconInfo, IconClose, IconLayers, IconShield, IconBox, IconDownload } from '../../design-system/icons'
import type { KeyRecord, KeyAssignment } from '../../data/keyTypes'
import type { Printer } from '../../data/types'
import type { ScopedPluginVars } from '../../data/plugin-vars'
import { PrintersPane, type PrinterManagementProps } from './panes/printers'
import { PrinterActionsContext, type PrinterActions } from './printer-actions'
import { KeysPane } from './panes/keys'
import { AccessPane } from './panes/AccessPane'
import { GitHostPane } from './panes/git-host'
import { RepositoriesPane } from './panes/RepositoriesPane'
import { AdaptersPane } from './panes/AdaptersPane'
import { AppearancePane } from './panes/AppearancePane'
import { ScopedPluginDefaultsPane } from './panes/ScopedPluginDefaultsPane'
import { LanguagePane, makeDefaultLocaleSettings } from './panes/language'
import { AboutPane } from './panes/AboutPane'
import { UpdatePane } from './panes/update'
import { LabsPane } from './panes/LabsPane'
import { PanelSpinner } from '../common/feedback/PanelSpinner'
import { useAdaptersList, useGitHostSettings, useKeysManager } from './state'
import type { LocaleSettings } from './panes/language'

const NAV = [
  { id: 'general',  label: 'General',       tKey: 'set.general',  icon: IconSliders,   tint: 'tint-violet' },
  { id: 'plugin-defaults', label: 'Plugin defaults', tKey: 'set.plugin_defaults', icon: IconBox, tint: 'tint-amber' },
  { id: 'language', label: 'Language',      tKey: 'set.language', icon: IconGlobe,     tint: 'tint-pink' },
  { id: 'printers', label: 'Printers',      tKey: 'set.printers', icon: IconPrinter,   tint: 'tint-rose' },
  { id: 'keys',     label: 'Keys',          tKey: 'set.keys',     icon: IconKey,       tint: 'tint-blue' },
  { id: 'access',   label: 'Access',        tKey: 'set.access',   icon: IconShield,    tint: 'tint-cyan' },
  { id: 'git-host', label: 'Git Host',      tKey: 'set.git_host', icon: IconGitBranch, tint: 'tint-green' },
  { id: 'repos',    label: 'Repositories',  tKey: 'set.repos',    icon: IconLayers,    tint: 'tint-amber' },
  { id: 'adapters', label: 'Adapters',      tKey: 'set.adapters', icon: IconChip,      tint: 'tint-teal' },
  { id: 'labs',     label: 'Labs',          tKey: 'set.labs',     icon: IconChip,      tint: 'tint-amber' },
  { id: 'update',   label: 'Update',        tKey: 'set.update',   icon: IconDownload,  tint: 'tint-cyan' },
  { id: 'about',    label: 'About',         tKey: 'set.about',    icon: IconInfo,      tint: 'tint-slate' },
] as const

export type Section = (typeof NAV)[number]['id']

// Panes a release build leaves out: key signing and the Labs experiments are for people building
// plugins, not for the shipped app.
const UNRELEASED_SECTIONS: Section[] = ['keys', 'labs']

function releasedSections(): (typeof NAV)[number][] {
  if (showsUnreleasedFeatures()) return NAV.slice()

  return NAV.filter((navItem) => !UNRELEASED_SECTIONS.includes(navItem.id))
}

type Density = 'compact' | 'comfortable' | 'spacious'

interface SettingsProps extends PrinterManagementProps {
  onClose: () => void
  initialPane?: Section
  theme: 'light' | 'dark' | 'system'
  onSetTheme: (t: 'light' | 'dark' | 'system') => void
  density: Density
  onSetDensity: (d: Density) => void
  storeGrouped: boolean
  onSetStoreGrouped: (v: boolean) => void
  localePref: string
  onSetLocale: (code: string) => void
  // The header-selected printer: the Plugin defaults Per-printer view follows it (one selection
  // facility app-wide; the header widget stays clickable above the Settings modal).
  selectedPrinter: Printer | null
  scopedPluginVars: ScopedPluginVars
  onScopedPluginVarsChange: (next: ScopedPluginVars) => void
}

interface SettingsSidebarProps {
  search: string
  section: Section
  visibleSections: (typeof NAV)[number][]
  onSearchChange: (value: string) => void
  onSectionChange: (id: Section) => void
}

interface SettingsContentProps {
  printers: Printer[]
  section: Section
  activeSection: (typeof NAV)[number] | undefined
  adapters: AdapterInfo[]; keys: KeyRecord[]; keysLoaded: boolean
  gitHostSettings: GitHostSettings | null; allUserRepos: { owner: string; repo: string }[]; gitHostLoaded: boolean
  localeSettings: LocaleSettings
  theme: 'light' | 'dark' | 'system'; onSetTheme: (t: 'light' | 'dark' | 'system') => void
  density: Density; onSetDensity: (d: Density) => void
  storeGrouped: boolean; onSetStoreGrouped: (v: boolean) => void
  onLocaleChange: (s: LocaleSettings) => void
  onGenerate: (label: string) => Promise<void>; onRemove: (key: KeyRecord) => Promise<void>
  onSetDefault: (key: KeyRecord) => Promise<void>
  onSetAssignments: (key: KeyRecord, assignments: KeyAssignment[]) => Promise<void>
  onSetIcon: (key: KeyRecord, color?: string, image?: string, size?: number) => Promise<void>
  onSetPublishedAt: (key: KeyRecord, date: string | null) => void
  reloadGitHostSettings: () => void
  selectedPrinter: Printer | null
  scopedPluginVars: ScopedPluginVars
  onScopedPluginVarsChange: (next: ScopedPluginVars) => void
  onNavigate: (section: Section) => void
}

function SettingsContent({ section, activeSection, printers, adapters, keys, keysLoaded, gitHostSettings, allUserRepos, gitHostLoaded, localeSettings, theme, onSetTheme, density, onSetDensity, storeGrouped, onSetStoreGrouped, onLocaleChange, onGenerate, onRemove, onSetDefault, onSetAssignments, onSetIcon, onSetPublishedAt, reloadGitHostSettings, selectedPrinter, scopedPluginVars, onScopedPluginVarsChange, onNavigate }: SettingsContentProps) {
  const { t } = useI18n()

  return (
    <div className="settings-content">
      <div className="settings-content-head">
        <h2>{activeSection ? t(activeSection.tKey) : ''}</h2>
      </div>
      <div className="settings-content-body">
        {section === 'general' && <AppearancePane theme={theme} onSetTheme={onSetTheme} density={density} onSetDensity={onSetDensity} storeGrouped={storeGrouped} onSetStoreGrouped={onSetStoreGrouped} localeSettings={localeSettings} onLocaleChange={onLocaleChange} />}
        {section === 'plugin-defaults' && <ScopedPluginDefaultsPane printers={printers} selectedPrinter={selectedPrinter} scopedVars={scopedPluginVars} onScopedVarsChange={onScopedPluginVarsChange} />}
        {section === 'language' && <LanguagePane settings={localeSettings} onChange={onLocaleChange} />}
        {section === 'printers' && <PrintersPane printers={printers} adapters={adapters} />}
        {section === 'keys' && (
          keysLoaded && gitHostLoaded
            ? <KeysPane keys={keys} printers={printers} gitHostSettings={gitHostSettings} allUserRepos={allUserRepos}
                onGenerate={onGenerate} onRemove={onRemove} onSetDefault={onSetDefault}
                onSetAssignments={onSetAssignments} onSetIcon={onSetIcon} onSetPublishedAt={onSetPublishedAt} />
            : <PanelSpinner />
        )}
        {section === 'access' && <AccessPane printers={printers} />}
        {section === 'git-host' && <GitHostPane onSettingsUpdated={reloadGitHostSettings} />}
        {section === 'repos' && <RepositoriesPane onConnectGitHub={() => onNavigate('git-host')} />}
        {section === 'adapters' && <AdaptersPane adapters={adapters} printers={printers} />}
        {section === 'labs' && <LabsPane />}
        {section === 'update' && <UpdatePane />}
        {section === 'about' && <AboutPane />}
      </div>
    </div>
  )
}

function SettingsSidebar({
  search,
  section,
  visibleSections,
  onSearchChange,
  onSectionChange,
}: SettingsSidebarProps) {
  const { t } = useI18n()

  return (
    <aside className="settings-sidebar">
      <div className="settings-search">
        <span className="search-icon">
          <IconSearch size={13} />
        </span>
        <input
          type="text"
          placeholder={t('set.search')}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <nav className="settings-nav">
        {visibleSections.map((navItem) => (
          <button
            key={navItem.id}
            className={cx('settings-nav-item', navItem.id === section && 'active')}
            onClick={() => onSectionChange(navItem.id)}
          >
            <span className={cx('settings-nav-icon', navItem.tint)}>
              <navItem.icon size={13} />
            </span>
            {t(navItem.tKey)}
          </button>
        ))}
      </nav>
    </aside>
  )
}

export function Settings({
  onClose,
  initialPane,
  printers,
  onAddPrinter,
  onRemovePrinter,
  onUpdatePrinterIcon,
  onEnrollPrinter, onRepairPrinter, onRecoverPrinter, onReinstallPlugins,
  onViewEnrollmentLog, onUpdateDaemon, onUpdateJinni,
  onDeactivatePrinter, onReactivatePrinter, onUninstallPrinter,
  onSetCustomSshCredentials,
  theme, onSetTheme,
  density, onSetDensity,
  storeGrouped, onSetStoreGrouped,
  localePref, onSetLocale,
  selectedPrinter, scopedPluginVars, onScopedPluginVarsChange,
}: SettingsProps) {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>(initialPane ?? 'general')
  const [search, setSearch] = useState('')
  const [localeSettings, setLocaleSettings] = useState<LocaleSettings>(() => ({
    ...makeDefaultLocaleSettings(),
    locale: localePref,
  }))

  const adapters = useAdaptersList()
  const { keys, loaded: keysLoaded, handleGenerate, handleRemove, handleSetDefault, handleSetAssignments, handleSetIcon, handleSetPublishedAt } =
    useKeysManager()
  const { settings: gitHostSettings, allUserRepos, loaded: gitHostLoaded, reload: reloadGitHostSettings } = useGitHostSettings()

  function handleLocaleChange(next: LocaleSettings) {
    setLocaleSettings(next)
    onSetLocale(next.locale)
  }

  const visibleSections = releasedSections().filter(
    (navItem) => !search || navItem.label.toLowerCase().includes(search.toLowerCase())
  )
  const activeSection = NAV.find((navItem) => navItem.id === section)
  const printerActions: PrinterActions = {
    onAddPrinter, onRemovePrinter, onUpdatePrinterIcon, onEnrollPrinter, onRepairPrinter,
    onRecoverPrinter, onReinstallPlugins, onViewEnrollmentLog, onUpdateDaemon, onUpdateJinni,
    onDeactivatePrinter, onReactivatePrinter, onUninstallPrinter, onSetCustomSshCredentials,
  }

  return (
    <Modal onClose={onClose} scrimClassName="settings-scrim" surfaceClassName="settings-window">
      <div className="settings-header">
        <span className="settings-header-title">{t('set.title')}</span>
        <button className="settings-close" onClick={onClose} title={t('btn.close')}>
          <IconClose size={14} />
        </button>
      </div>

      <div className="settings-body">
        <SettingsSidebar
          search={search}
          section={section}
          visibleSections={visibleSections}
          onSearchChange={setSearch}
          onSectionChange={setSection}
        />

        <PrinterActionsContext.Provider value={printerActions}>
          <SettingsContent
            section={section} activeSection={activeSection}
            printers={printers} adapters={adapters} keys={keys} keysLoaded={keysLoaded}
            gitHostSettings={gitHostSettings} allUserRepos={allUserRepos} gitHostLoaded={gitHostLoaded}
            localeSettings={localeSettings}
            theme={theme} onSetTheme={onSetTheme}
            density={density} onSetDensity={onSetDensity}
            storeGrouped={storeGrouped} onSetStoreGrouped={onSetStoreGrouped}
            onLocaleChange={handleLocaleChange}
            onGenerate={handleGenerate} onRemove={handleRemove} onSetDefault={handleSetDefault}
            onSetAssignments={handleSetAssignments} onSetIcon={handleSetIcon}
            onSetPublishedAt={handleSetPublishedAt} reloadGitHostSettings={reloadGitHostSettings}
            selectedPrinter={selectedPrinter} scopedPluginVars={scopedPluginVars} onScopedPluginVarsChange={onScopedPluginVarsChange}
            onNavigate={setSection}
          />
        </PrinterActionsContext.Provider>
      </div>
    </Modal>
  )
}
