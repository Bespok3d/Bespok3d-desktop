// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GlobalProvider } from '@ladle/react'
// The app loads only the 3 design-system globals eagerly; every other stylesheet is pulled in lazily by
// whichever component imports it. A catalog renders leaf components in isolation, so it must load the
// full app stylesheet up front. We load the design-system globals first (cascade order), then eager-glob
// every component stylesheet, so any catalogued component is styled without per-story CSS detective work.
import '../src/renderer/src/design-system/tokens.css'
import '../src/renderer/src/design-system/app.css'
import '../src/renderer/src/design-system/utilities.css'
import.meta.glob('../src/renderer/src/components/**/*.css', { eager: true })
import './ladle-overrides.css'
import { I18nProvider } from '../src/renderer/src/i18n/context'
import { makeT } from '../src/renderer/src/i18n'
import { CatalogProvider } from '../src/renderer/src/data/catalog'
import { makeCatalog, makeAdapterInfo, makeIndexEntry, makeEnrollEvent, makeCapabilities, makeInstallLog } from '../src/renderer/src/test/fixtures'

// A few catalog plugins so stories can show plugin-update state (a printer with an older installed
// version of one of these reads as updatable). Versions here are the "latest available". Spoolman
// and Fluidd carry real `config` fields so the Plugin Defaults settings panes (which read the loaded
// catalog, not story-local fixtures) have real editable rows to show, including a printer-hinted
// field and a second plugin for the by-plugin sections + installed-only filter states.
// Server/Mode/Port stay scope-less on purpose: they exercise the legacy-manifest stamping path.
const CATALOG_PLUGINS = [
  makeIndexEntry({
    name: 'spoolman', title: 'Spoolman', version: '1.2.0',
    config: [
      { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', userEditable: true, placeholder: 'http://host:7912', hint: 'Moonraker reads spool data from this address.' },
      { key: 'SPOOLMAN_MODE', label: 'Mode', type: 'select', options: ['auto', 'manual'], default: 'auto', userEditable: true },
      { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', userEditable: true, scope: 'printer', hint: 'Where this printer files its spools in Spoolman.' },
    ],
  }),
  makeIndexEntry({ name: 'camera-hw-accel', title: 'HW Camera', version: '1.1.0' }),
  makeIndexEntry({
    name: 'fluidd', title: 'Fluidd', version: '1.3.0',
    config: [
      { key: 'FLUIDD_PORT', label: 'Web UI port', type: 'http-port', default: '80', userEditable: true, hint: 'Only one plugin can serve on port 80 at a time.' },
    ],
  }),
]

// A short, visible delay so a plugin op reads as real work in progress rather than an instant flicker,
// mirroring how the daemon actually takes a moment to install/reconfigure a package.
function resolveAfter<T>(value: T, delayMs = 400): Promise<T> {
  return new Promise((resolve) => { setTimeout(() => resolve(value), delayMs) })
}

// An op-mode Enrollment (repair, recovery, update, ...) opened from a story auto-runs and waits for
// progress. With no feed it would hang on a bare bar, so the stub records which printer is acting and,
// shortly after a story subscribes, emits one terminal "done" event for it. The modal then lands on the
// REAL success view (closable via Done), making the click-through a faithful flow, not a dead bar.
const ENROLL_DONE_STEPS = [
  { id: 'deploy-daemon', label: 'Deploy daemon', detail: 'Uploaded daemon + jinni' },
  { id: 'start-daemon', label: 'Start daemon', detail: 'Daemon responding on :4269' },
]
const opTarget = { printerId: 'printer-1' }
function recordOp(printerId: string): Promise<void> {
  opTarget.printerId = printerId

  return Promise.resolve()
}
function emitOpSuccess(notify: (event: ReturnType<typeof makeEnrollEvent>) => void): () => void {
  const handle = setTimeout(() => notify(makeEnrollEvent({
    printerId: opTarget.printerId, stepId: 'start-daemon', stepLabel: 'Start daemon',
    status: 'done', stepIndex: 1, totalSteps: 2, completedSteps: ENROLL_DONE_STEPS,
  })), 200)

  return () => clearTimeout(handle)
}

// The header trigger watches the selected printer's print state, so the catalog needs the feed too.
// The stub answers the way the real feed does (it delivers the current blocked-action set the moment
// the watch opens), and a printer whose story says it is printing gets a non-empty set so the header
// shows the real live phrase instead of a permanently idle one.
const PRINTING_BLOCKED_ACTIONS = ['plugin_install', 'plugin_uninstall']
const printWatch = { printerId: '' }
function watchPrintState(printerId: string): Promise<void> {
  printWatch.printerId = printerId

  return Promise.resolve()
}
function emitPrintState(notify: (event: { printerId: string; blockedActions: string[]; at: number }) => void): () => void {
  const handle = setTimeout(() => notify({
    printerId: printWatch.printerId,
    blockedActions: printWatch.printerId.includes('printing') ? PRINTING_BLOCKED_ACTIONS : [],
    at: Date.now(),
  }), 200)

  return () => clearTimeout(handle)
}

// The catalog runs in a plain Vite browser context: there is no preload bridge and no vitest, so the
// test b3d-mock (which imports vitest) cannot be reused. We install only the few window.b3d surfaces
// the catalogued components actually touch; story data reuses the vitest-free fixtures factories.
const catalogConsent: { answer: 'granted' | 'refused' | null } = { answer: null }

const catalogB3d = {
  daemonExpectedVersion: '0.12.10-dev',
  jinniExpectedVersion: '0.1.6',
  openUrl(url: string) {
    window.open(url, '_blank')

    return Promise.resolve()
  },
  printers: {
    adaptersList: () => Promise.resolve([makeAdapterInfo()]),
    adapterGet: () => Promise.resolve(makeAdapterInfo()),
    load: () => Promise.resolve([]),
    enroll: recordOp,
    repair: recordOp,
    reactivate: recordOp,
    updateDaemon: recordOp,
    updateJinni: recordOp,
    onEnrollProgress: emitOpSuccess,
    watchPrintState,
    unwatchPrintState: () => Promise.resolve(),
    onPrintState: emitPrintState,
  },
  registry: { catalog: () => Promise.resolve(makeCatalog(CATALOG_PLUGINS)) },
  // Usage reporting reads its own answer back rather than taking it as a prop, so the stub keeps one
  // in memory: the toggle in a story really flips, and the catalog starts unanswered because that is
  // the only state in which the one-time request appears at all.
  analytics: {
    reportRenderFailure: () => Promise.resolve(),
    consent: () => Promise.resolve({ answer: catalogConsent.answer, ask: catalogConsent.answer === null }),
    setConsent: (granted: boolean) => {
      catalogConsent.answer = granted ? 'granted' : 'refused'

      return Promise.resolve()
    },
    resetIdentity: () => Promise.resolve(),
  },
  // The plugin detail panel's install/uninstall/reconfigure + captured-log surfaces. Every call
  // resolves with dummy-but-plausible data so a story can be clicked through, not just looked at.
  store: {
    capabilities: () => Promise.resolve(makeCapabilities({})),
    install: (_printerId: string, pluginId: string) => resolveAfter({ installedIds: [pluginId], log: makeInstallLog(pluginId) }),
    uninstall: () => resolveAfter([] as string[]),
    reconfigure: (_printerId: string, pluginId: string) => resolveAfter({ installedIds: [pluginId], log: makeInstallLog(pluginId) }),
    // The Config tab's live truth read: spoolman answers (tier 'live'); any other plugin returns
    // null, so a story can show the applied-marker and unknown tiers via the printer record alone.
    // Values are obviously-fake (RFC 2606 example domain), never a real deployment's address.
    pluginConfig: (_printerId: string, pluginId: string) =>
      resolveAfter(pluginId === 'spoolman' ? { SPOOLMAN_SERVER: 'http://spoolman.example:7912', SPOOLMAN_MODE: 'auto' } : null),
    onPluginProgress: () => () => {},
    pluginCaptures: () => Promise.resolve(['[12:00:01] service started', '[12:00:04] listening on :7912']),
    watchPluginLog: () => Promise.resolve(),
    unwatchPluginLog: () => Promise.resolve(),
    onPluginLog: () => () => {},
  },
}

;(window as unknown as { b3d: unknown }).b3d = catalogB3d

const i18nValue = {
  locale: 'en' as const,
  t: makeT('en'),
  setLocale: () => {},
  customLocales: {},
  setCustomTranslations: () => {},
}

// Wrap every story in the same providers App.tsx supplies: localization and the loaded catalog. The
// global stylesheets are imported above so components render with real tokens, not unstyled markup.
export const Provider: GlobalProvider = ({ children }) => (
  <I18nProvider value={i18nValue}>
    <CatalogProvider>{children}</CatalogProvider>
  </I18nProvider>
)
