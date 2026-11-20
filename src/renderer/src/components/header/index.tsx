// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../i18n/context'
import { IconSun, IconMoon, IconSettings } from '../../design-system/icons'
import { BrandMark } from '../../design-system/BrandMark'
import { PrinterDropdown } from './printer-dropdown'
import type { PrinterDropdownProps } from './printer-dropdown'
import { Button } from '../common/Button'
import { NotificationCenter } from '../notifications/NotificationCenter'
import type { NotificationCenterProps } from '../notifications/NotificationCenter'
import type { Section } from '../settings'

// The header owns the printer dropdown and the notification center and forwards their props straight
// through, so it extends both prop sets rather than restating them, and adds only its own chrome. The
// center's settings opener is named onOpenSettingsPane here, since the dropdown already owns onOpenSettings.
export interface HeaderProps extends PrinterDropdownProps, Omit<NotificationCenterProps, 'onOpenSettings'> {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettingsPane: (pane: Section) => void
  empty?: boolean
}

export function Header({
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenSettingsPane,
  onOpenPlugin,
  installedVersions,
  installedSources,
  installedFingerprints,
  printers,
  selectedId,
  adapterIcons,
  adapterTitles,
  adapterJinniOffers,
  savedPluginVars,
  onSelect,
  onAddPrinter,
  onUpdateDaemon,
  onUpdateJinni,
  onUpdateAll,
  installingCount,
  empty,
}: HeaderProps) {
  const { t } = useI18n()

  return (
    <div className="header">
      <div className="brand">
        <BrandMark tile={52} />
        <span>Bespok3d</span>
      </div>
      {!empty && (
        <PrinterDropdown
          printers={printers}
          selectedId={selectedId}
          adapterIcons={adapterIcons}
          adapterTitles={adapterTitles}
          adapterJinniOffers={adapterJinniOffers}
          savedPluginVars={savedPluginVars}
          onSelect={onSelect}
          onAddPrinter={onAddPrinter}
          onOpenSettings={onOpenSettings}
          onUpdateDaemon={onUpdateDaemon}
          onUpdateJinni={onUpdateJinni}
          onUpdateAll={onUpdateAll}
          installingCount={installingCount}
        />
      )}
      <div className="header-spacer" />
      <div className="header-actions">
        <NotificationCenter onOpenSettings={onOpenSettingsPane} onOpenPlugin={onOpenPlugin} installedVersions={installedVersions} installedSources={installedSources} installedFingerprints={installedFingerprints} />
        <Button
          variant="ghost"
          icon
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </Button>
        <Button
          variant="ghost"
          icon
          aria-label={t('header.settings')}
          title={t('header.settings')}
          onClick={onOpenSettings}
        >
          <IconSettings size={16} />
        </Button>
      </div>
    </div>
  )
}
