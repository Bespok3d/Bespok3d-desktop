import { describe, it, expect } from 'vitest'
import { makePlugin } from '../../../test/fixtures'
import type { PluginConfigField } from '../../../data/types'
import {
  editableDefaults,
  installedPluginIds,
  visibleDefaults,
  groupDefaultsByPlugin,
  defaultsRowLabel,
} from './defaults-entries'

function textField(key: string, label: string): PluginConfigField {
  return { key, label, type: 'text', userEditable: true, scope: 'global' }
}

const SPOOLMAN = makePlugin({
  id: 'spoolman', name: 'spoolman', title: 'Spoolman',
  config: [textField('SPOOLMAN_SERVER', 'Server URL'), textField('SPOOLMAN_LOCATION', 'Location')],
})
const FLUIDD = makePlugin({
  id: 'fluidd', name: 'fluidd', title: 'Fluidd',
  config: [textField('FLUIDD_PORT', 'Web UI port')],
})
const CATALOG = [SPOOLMAN, FLUIDD]

describe('editableDefaults', () => {
  it('lists every user-editable field in catalog order and skips locked ones', () => {
    const lockedField = { ...textField('SPOOLMAN_MODE', 'Mode'), userEditable: false }
    const withLocked = makePlugin({ ...SPOOLMAN, config: [...(SPOOLMAN.config ?? []), lockedField] })
    const entries = editableDefaults([withLocked, FLUIDD])
    expect(entries.map((entry) => entry.field.key)).toEqual(['SPOOLMAN_SERVER', 'SPOOLMAN_LOCATION', 'FLUIDD_PORT'])
  })
})

describe('installedPluginIds', () => {
  it('unions installed ids across the fleet', () => {
    const workshopPrinter = { installedVersions: { spoolman: '1.0.0' } }
    const officePrinter = { installedVersions: { fluidd: '1.0.0' } }
    expect(installedPluginIds([workshopPrinter, officePrinter])).toEqual(new Set(['spoolman', 'fluidd']))
  })

  it('treats a printer with no recorded installs as empty', () => {
    expect(installedPluginIds([{}, { installedVersions: { spoolman: '1.0.0' } }])).toEqual(new Set(['spoolman']))
  })

  it('is empty for an empty fleet (per-printer view with nothing selected)', () => {
    expect(installedPluginIds([])).toEqual(new Set())
  })
})

describe('visibleDefaults', () => {
  const allEntries = editableDefaults(CATALOG)

  it('keeps only installed plugins when a set is given', () => {
    const visible = visibleDefaults(allEntries, new Set(['fluidd']), '')
    expect(visible.map((entry) => entry.field.key)).toEqual(['FLUIDD_PORT'])
  })

  it('applies no install constraint for the All plugins position (null set)', () => {
    expect(visibleDefaults(allEntries, null, '')).toHaveLength(3)
  })

  it('matches the query against the plugin title, case-insensitive', () => {
    const visible = visibleDefaults(allEntries, null, 'SPOOL')
    expect(visible.map((entry) => entry.plugin.id)).toEqual(['spoolman', 'spoolman'])
  })

  it('matches the query against the field label', () => {
    const visible = visibleDefaults(allEntries, null, 'web ui')
    expect(visible.map((entry) => entry.field.key)).toEqual(['FLUIDD_PORT'])
  })

  it('returns no rows on a query nothing matches', () => {
    expect(visibleDefaults(allEntries, null, 'zzz-no-such-thing')).toEqual([])
  })

  it('composes the install filter with the query', () => {
    expect(visibleDefaults(allEntries, new Set(['fluidd']), 'location')).toEqual([])
  })
})

describe('groupDefaultsByPlugin', () => {
  it('sections entries under their plugin, preserving catalog order', () => {
    const groups = groupDefaultsByPlugin(editableDefaults(CATALOG))
    expect(groups.map((group) => group.plugin.id)).toEqual(['spoolman', 'fluidd'])
    expect(groups[0].entries.map((entry) => entry.field.key)).toEqual(['SPOOLMAN_SERVER', 'SPOOLMAN_LOCATION'])
    expect(groups[1].entries.map((entry) => entry.field.key)).toEqual(['FLUIDD_PORT'])
  })
})

describe('defaultsRowLabel', () => {
  it('prefixes the field label with the plugin title for the flat list', () => {
    expect(defaultsRowLabel(editableDefaults([FLUIDD])[0])).toBe('Fluidd: Web UI port')
  })
})
