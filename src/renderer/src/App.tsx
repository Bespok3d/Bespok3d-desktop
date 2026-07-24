import { useState, useEffect } from 'react'
import { I18nProvider } from './i18n/context'
import { CatalogProvider } from './data/catalog'
import { Header } from './components/header'
import { Settings, type Section } from './components/settings'
import { FirstRun } from './components/FirstRun'
import { PluginStore } from './components/plugin-store'
import { LocalDropZone } from './components/LocalDropZone'
import { Create, ModeBar } from './components/create'
import { PrinterBanners } from './components/printer-banners'
import { usePrinterSync, useMdnsDiscovery } from './hooks/printers'
import { useAdapterIcons, useAdapterJinniVersions } from './hooks/adapters'
import { useDisplayPrefs } from './hooks/displayPrefs'
import { useAppI18n } from './app/locale'
import { useAppCallbacks } from './app/callbacks'
import { useB3dDeepLinks } from './app/deep-links'
import { usePluginVars } from './app/plugin-vars'
import { printerKeyFor } from './data/plugin-vars'
import { AppModals } from './app/AppModals'

function App() {
  const { i18n, localePref, setLocalePref } = useAppI18n()
  const { theme, setTheme, setThemeOverride, resolved, density, setDensity, storeGrouped, setStoreGrouped } = useDisplayPrefs()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsPane, setSettingsPane] = useState<Section | undefined>(undefined)
  const [mode, setMode] = useState<'store' | 'create'>('store')
  const [focusPluginId, setFocusPluginId] = useState<string | null>(null)
  const [workbenchLayout, setWorkbenchLayout] = useState<'A' | 'B'>('A')
  function subscribeOpenSettings() {
    return window.b3d.appUpdate.onOpenSettings(() => { setSettingsPane('update'); setSettingsOpen(true) })
  }
  useEffect(subscribeOpenSettings, [])
  function subscribeOpenAbout() {
    return window.b3d.onOpenAbout(() => { setSettingsPane('about'); setSettingsOpen(true) })
  }
  useEffect(subscribeOpenAbout, [])
  function loadWorkbenchLayout() {
    window.b3d.settings.get().then((settings) => setWorkbenchLayout(settings.workbenchLayout))
  }
  useEffect(loadWorkbenchLayout, [])
  const { printers, setPrinters, selectedId, setSelectedId, handleRemovePrinter, handleUpdatePrinterIcon, handleSetCustomSshCredentials } = usePrinterSync()
  const { discovered, setDiscovered } = useMdnsDiscovery(setPrinters)
  const adapterIcons = useAdapterIcons()
  const jinniVersions = useAdapterJinniVersions()
  const actions = useAppCallbacks(printers, setPrinters, setSelectedId, setDiscovered, handleRemovePrinter)
  const selectedPrinter = printers.find((printer) => printer.id === selectedId) ?? null
  const pluginVars = usePluginVars(printers)
  const selectedPrinterKey = selectedPrinter ? printerKeyFor(selectedPrinter) : undefined
  const savedPluginVars = pluginVars.viewFor(selectedPrinterKey)
  useB3dDeepLinks({ printers, openPlugin: (name) => { setMode('store'); setFocusPluginId(name) }, openRepos: () => { setSettingsPane('repos'); setSettingsOpen(true) }, selectPrinter: setSelectedId })
  function mainPane() {
    if (printers.length === 0) return <FirstRun discovered={discovered} onOpenAdd={actions.openAdd} onOpenManual={actions.openManual} onRescan={actions.handleRescan} />
    if (mode === 'create') return <Create printer={selectedPrinter} layout={workbenchLayout} onSetLayout={(next) => { setWorkbenchLayout(next); window.b3d.settings.set({ workbenchLayout: next }) }} />

    return <PluginStore printer={selectedPrinter} density={density} grouped={storeGrouped} onPrinterUpdate={setPrinters} savedPluginVars={savedPluginVars} onSaveVars={(save) => pluginVars.saveFor(selectedPrinterKey, save)} scopeFor={(field) => pluginVars.scopeFor(selectedPrinterKey, field)} onUpdateAll={actions.handleUpdateAll} updatingAll={actions.updatingAll} onInstallSelected={actions.handleInstallBatch} installingSelected={actions.installingBatch} onUninstallSelected={actions.handleUninstallBatch} uninstallingSelected={actions.uninstallingBatch} focusPluginId={focusPluginId} onFocusHandled={() => setFocusPluginId(null)} onConnectGitHub={() => { setSettingsPane('git-host'); setSettingsOpen(true) }} />
  }

  return (
    <I18nProvider value={i18n}>
      <CatalogProvider>
      <LocalDropZone selectedPrinter={selectedPrinter} onInstall={(id) => { setMode('store'); setFocusPluginId(id) }} />
      <div className="app" data-theme={resolved} data-platform={window.b3d.platform}>
        <Header
          theme={resolved}
          onToggleTheme={() => setThemeOverride(resolved === 'light' ? 'dark' : 'light')}
          onOpenSettings={() => { setSettingsPane(undefined); setSettingsOpen(true) }}
          onOpenSettingsPane={(pane) => { setSettingsPane(pane); setSettingsOpen(true) }}
          onOpenPlugin={(id) => { setMode('store'); setFocusPluginId(id) }}
          installedVersions={selectedPrinter?.installedVersions ?? {}}
          printers={printers} selectedId={selectedId} adapterIcons={adapterIcons} adapterJinniVersions={jinniVersions} savedPluginVars={savedPluginVars} onSelect={setSelectedId}
          onAddPrinter={actions.openAdd} onUpdateDaemon={actions.handleUpdateDaemon} onUpdateJinni={actions.handleUpdateJinni} onUpdateAll={actions.handleUpdateAll}
          installingCount={0} empty={printers.length === 0}
        />
        {printers.length > 0 && <ModeBar mode={mode} onModeChange={setMode} printerName={selectedPrinter?.nick} />}
        <PrinterBanners selectedPrinter={selectedPrinter} bundledJinniVersion={selectedPrinter ? jinniVersions[selectedPrinter.adapter] : undefined} onRepair={actions.handleRepairPrinter} onRecover={actions.handleRecoverPrinter} onReactivate={actions.handleReactivatePrinter} onRecoverDrift={actions.handleRecoverDrift} onUpdateJinni={actions.handleUpdateJinni} />
        <div className="u-fill">
          {mainPane()}
        </div>
        {settingsOpen && (
          <Settings
            onClose={() => { setSettingsOpen(false); loadWorkbenchLayout() }}
            initialPane={settingsPane}
            printers={printers} onAddPrinter={actions.openAdd}
            onRemovePrinter={handleRemovePrinter} onUpdatePrinterIcon={handleUpdatePrinterIcon}
            onEnrollPrinter={actions.handleEnrollPrinter} onRepairPrinter={actions.handleRepairPrinter}
            onRecoverPrinter={actions.handleRecoverPrinter} onReinstallPlugins={actions.handleRecoverDrift}
            onViewEnrollmentLog={actions.handleViewEnrollmentLog}
            onUpdateDaemon={actions.handleUpdateDaemon} onUpdateJinni={actions.handleUpdateJinni} onDeactivatePrinter={actions.handleDeactivatePrinter}
            onReactivatePrinter={actions.handleReactivatePrinter} onUninstallPrinter={actions.handleUninstallPrinter}
            onSetCustomSshCredentials={handleSetCustomSshCredentials}
            theme={theme} onSetTheme={(next) => { setThemeOverride(null); setTheme(next) }} density={density} onSetDensity={setDensity}
            storeGrouped={storeGrouped} onSetStoreGrouped={setStoreGrouped}
            localePref={localePref} onSetLocale={setLocalePref}
            selectedPrinter={selectedPrinter} scopedPluginVars={pluginVars.scopedVars} onScopedPluginVarsChange={pluginVars.setScopedVars}
          />
        )}
        <AppModals actions={actions} discovered={discovered} existingPrinters={printers} />
      </div>
      </CatalogProvider>
    </I18nProvider>
  )
}

export default App
