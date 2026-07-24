import { useState } from 'react'
import { Group } from '../../common/Group'
import { SettingRow } from '../../common/SettingRow'
import { Segmented } from '../../common/Segmented'
import { useI18n } from '../../../i18n/context'
import { useCatalog } from '../../../data/catalog'
import { IconSearch } from '../../../design-system/icons'
import { FieldInput } from '../../plugin-store/config/config-form'
import type { Printer } from '../../../data/types'
import {
  GLOBAL_SCOPE,
  localScopeKey,
  printerKeyFor,
  resolveFieldValue,
  saveFieldValue,
  fieldIsPrinterScoped,
} from '../../../data/plugin-vars'
import type { ScopedPluginVars } from '../../../data/plugin-vars'
import {
  editableDefaults,
  installedPluginIds,
  visibleDefaults,
  groupDefaultsByPlugin,
  defaultsRowLabel,
  defaultsRowKey,
} from './defaults-entries'
import type { DefaultsEntry, PluginDefaultsGroup, ScopedDefaultsStore } from './defaults-entries'
import { PrinterDefaultRow } from './defaults-printer-row'

// The two faces of the defaults manager, a strict DIVISION of the fields (a variable never has a
// mixed scope): shared fields live only in the All printers view, per-printer fields only in the
// Per printer view.
type DefaultsView = 'global' | 'printer'

// Whose fields the pane lists: only plugins the user actually runs (the default), or the whole
// catalog for browsing pre-install defaults.
type DefaultsFilter = 'installed' | 'all'

// How the rows read: sectioned under their plugin's name, or the flat "Plugin: Field" list.
type DefaultsOrganization = 'by-plugin' | 'flat'

// The pane needs a printer's display name, scope identity, and installed plugins, so renderer
// printer state and story fixtures both fit.
type ScopeTargetPrinter = Pick<Printer, 'id' | 'nick' | 'printerUuid' | 'installedVersions'>

type RenderDefaultsRow = (entry: DefaultsEntry, label: string) => React.ReactNode

interface DefaultsRowsProps {
  entries: DefaultsEntry[]
  organization: DefaultsOrganization
  emptyNote: string | null
}

// Which printers bound the "installed" filter: the whole fleet for the All printers view (installed
// anywhere counts), just the header-selected printer for the Per printer view.
function installFilterSources(view: DefaultsView, printers: ScopeTargetPrinter[], selectedPrinter: ScopeTargetPrinter | null): ScopeTargetPrinter[] {
  if (view === 'global') return printers

  return selectedPrinter ? [selectedPrinter] : []
}

// What an empty row run states: a fruitless search names itself; the Per printer view explains how
// a field becomes per-printer; the installed-only filter points at the All plugins position. An
// unfiltered empty catalog stays silent, as before.
function emptyNoteKey(view: DefaultsView, searching: boolean, installedOnly: boolean): string | null {
  if (searching) return 'gen.defaults_no_matches'
  if (view === 'printer') return 'gen.defaults_none_per_printer'

  return installedOnly ? 'gen.defaults_none_installed' : null
}

function PaneHint({ text }: { text: string }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-hint">{text}</div>
      </div>
    </div>
  )
}

function DefaultsToolbar({ query, filter, organization, onQuery, onFilter, onOrganization }: {
  query: string; filter: DefaultsFilter; organization: DefaultsOrganization
  onQuery: (query: string) => void
  onFilter: (filter: DefaultsFilter) => void
  onOrganization: (organization: DefaultsOrganization) => void
}) {
  const { t } = useI18n()

  return (
    <div className="defaults-toolbar">
      <div className="settings-search">
        <span className="search-icon"><IconSearch size={13} /></span>
        <input type="text" placeholder={t('gen.defaults_search')} value={query} onChange={(changeEvent) => onQuery(changeEvent.target.value)} />
      </div>
      <Segmented
        value={filter}
        options={[
          { value: 'installed', label: t('gen.defaults_filter_installed') },
          { value: 'all', label: t('gen.defaults_filter_all') },
        ]}
        onChange={onFilter}
      />
      <Segmented
        value={organization}
        options={[
          { value: 'by-plugin', label: t('gen.defaults_group_by_plugin') },
          { value: 'flat', label: t('gen.defaults_group_flat') },
        ]}
        onChange={onOrganization}
      />
    </div>
  )
}

function PluginFieldsSection({ group, renderRow }: { group: PluginDefaultsGroup; renderRow: RenderDefaultsRow }) {
  return (
    <>
      <div className="defaults-plugin-head">{group.plugin.title}</div>
      {group.entries.map((entry) => renderRow(entry, entry.field.label))}
    </>
  )
}

// The pane's row run under the toolbar: the caller's empty note when nothing is left to show,
// else the rows flat or sectioned.
function DefaultsRows({ entries, organization, emptyNote, renderRow }: DefaultsRowsProps & { renderRow: RenderDefaultsRow }) {
  if (entries.length === 0) return emptyNote === null ? null : <div className="set-empty">{emptyNote}</div>
  if (organization === 'flat') return <>{entries.map((entry) => renderRow(entry, defaultsRowLabel(entry)))}</>

  return (
    <>
      {groupDefaultsByPlugin(entries).map((group) => (
        <PluginFieldsSection key={group.plugin.id} group={group} renderRow={renderRow} />
      ))}
    </>
  )
}

// The VARIABLE-level scope switch on a shared field: flipping to "This printer" seeds the
// header-selected printer's own value from the shared one, which reclassifies the variable as
// per-printer for the whole fleet (it moves to the Per printer view). Without a selected printer
// there is nothing to seed, so that direction is disabled and the row hint says why.
function GlobalScopeSwitch({ entry, targetPrinterKey, sharedValue, store }: {
  entry: DefaultsEntry; targetPrinterKey: string | null; sharedValue: string; store: ScopedDefaultsStore
}) {
  const { t } = useI18n()

  return (
    <Segmented
      value="global"
      options={[
        { value: 'global', label: t('store.scope_all_printers') },
        { value: 'printer', label: t('store.scope_this_printer'), disabled: targetPrinterKey === null },
      ]}
      onChange={(choice) => {
        if (choice === 'printer' && targetPrinterKey !== null) {
          store.onScopedVarsChange(saveFieldValue(store.scopedVars, localScopeKey(targetPrinterKey), entry.field.key, sharedValue))
        }
      }}
    />
  )
}

function GlobalDefaultRow({ entry, label, targetPrinterKey, store }: {
  entry: DefaultsEntry; label: string; targetPrinterKey: string | null; store: ScopedDefaultsStore
}) {
  const { t } = useI18n()
  const sharedValue = resolveFieldValue(store.scopedVars, undefined, entry.field)
  const hintLines = [entry.field.hint, targetPrinterKey === null ? t('store.scope_note_select_printer') : undefined]
  const hint = hintLines.filter(Boolean).join(' ')

  return (
    <SettingRow
      className="defaults-scope-row"
      label={label}
      hint={hint || undefined}
      controls={
        <>
          <FieldInput
            field={entry.field}
            value={sharedValue}
            onChange={(value) => store.onScopedVarsChange(saveFieldValue(store.scopedVars, GLOBAL_SCOPE, entry.field.key, value))}
          />
          <GlobalScopeSwitch entry={entry} targetPrinterKey={targetPrinterKey} sharedValue={sharedValue} store={store} />
        </>
      }
    />
  )
}

function GlobalDefaults({ rows, targetPrinterKey, store }: {
  rows: DefaultsRowsProps; targetPrinterKey: string | null; store: ScopedDefaultsStore
}) {
  return (
    <DefaultsRows
      {...rows}
      renderRow={(entry, label) => (
        <GlobalDefaultRow key={defaultsRowKey(entry)} entry={entry} label={label} targetPrinterKey={targetPrinterKey} store={store} />
      )}
    />
  )
}

// The Per printer view has NO picker of its own: it follows the printer selected in the app header
// (the one selection facility, still clickable above the Settings modal), so "this printer" means
// the same printer here as everywhere else. This row just names the target.
function SelectedPrinterRow({ printer }: { printer: ScopeTargetPrinter }) {
  const { t } = useI18n()

  return (
    <SettingRow
      label={t('gen.defaults_printer_label')}
      hint={t('gen.defaults_selected_printer_hint')}
      controls={<span className="defaults-selected-printer">{printer.nick}</span>}
    />
  )
}

function PerPrinterDefaults({ selectedPrinter, rows, store }: {
  selectedPrinter: ScopeTargetPrinter | null; rows: DefaultsRowsProps; store: ScopedDefaultsStore
}) {
  const { t } = useI18n()
  if (!selectedPrinter) return <PaneHint text={t('gen.defaults_no_printers')} />
  const printerKey = printerKeyFor(selectedPrinter)

  return (
    <>
      <SelectedPrinterRow printer={selectedPrinter} />
      <DefaultsRows
        {...rows}
        renderRow={(entry, label) => (
          <PrinterDefaultRow key={defaultsRowKey(entry)} entry={entry} label={label} printerKey={printerKey} store={store} />
        )}
      />
    </>
  )
}

// Settings > Plugin defaults, the scoped-values manager. A variable never has a mixed scope: the
// manifest hint or any one printer's own value makes a field per-printer for the whole fleet, so
// the two views DIVIDE the fields (shared ones only under All printers, per-printer ones only
// under Per printer, which follows the header-selected printer), and every row carries the scope
// switch that moves its variable between the views. Edits go straight to the scoped store (App's
// persist effect dual-writes the legacy mirror); they never push to installed printers. The
// toolbar keeps the list fleet-sized: installed-only by default, sectioned by plugin, searchable.
export function ScopedPluginDefaultsPane({ printers, selectedPrinter, scopedVars, onScopedVarsChange, initialView, initialFilter, initialOrganization, initialQuery }: {
  printers: ScopeTargetPrinter[]
  selectedPrinter: ScopeTargetPrinter | null
  scopedVars: ScopedPluginVars
  onScopedVarsChange: (next: ScopedPluginVars) => void
  initialView?: DefaultsView
  initialFilter?: DefaultsFilter
  initialOrganization?: DefaultsOrganization
  initialQuery?: string
}) {
  const { t } = useI18n()
  const { plugins } = useCatalog()
  const [view, setView] = useState<DefaultsView>(initialView ?? 'global')
  const [filter, setFilter] = useState<DefaultsFilter>(initialFilter ?? 'installed')
  const [organization, setOrganization] = useState<DefaultsOrganization>(initialOrganization ?? 'by-plugin')
  const [query, setQuery] = useState(initialQuery ?? '')
  const store: ScopedDefaultsStore = { scopedVars, onScopedVarsChange }
  const installedOnly = filter === 'installed'
  const installedIds = installedOnly ? installedPluginIds(installFilterSources(view, printers, selectedPrinter)) : null
  const searchedEntries = visibleDefaults(editableDefaults(plugins), installedIds, query)
  const noteKey = emptyNoteKey(view, query.trim() !== '', installedOnly)
  const rows: DefaultsRowsProps = {
    entries: searchedEntries.filter((entry) => fieldIsPrinterScoped(scopedVars, entry.field) === (view === 'printer')),
    organization,
    emptyNote: noteKey === null ? null : t(noteKey),
  }

  return (
    <Group
      title={t('gen.plugin_defaults')}
      action={
        <Segmented
          value={view}
          options={[
            { value: 'global', label: t('gen.defaults_view_all') },
            { value: 'printer', label: t('gen.defaults_view_per_printer') },
          ]}
          onChange={setView}
        />
      }
    >
      <PaneHint text={t(view === 'global' ? 'gen.plugin_defaults_hint' : 'gen.defaults_per_printer_hint')} />
      <DefaultsToolbar query={query} filter={filter} organization={organization} onQuery={setQuery} onFilter={setFilter} onOrganization={setOrganization} />
      {view === 'global'
        ? <GlobalDefaults rows={rows} targetPrinterKey={selectedPrinter ? printerKeyFor(selectedPrinter) : null} store={store} />
        : <PerPrinterDefaults selectedPrinter={selectedPrinter} rows={rows} store={store} />}
    </Group>
  )
}
