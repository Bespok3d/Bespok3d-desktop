import { describe, it, expect } from 'vitest'
import { batchInstallable, installablePlugins, pluginsNeedingConfig, initialBatchValues, buildInstallSpecs } from './batch-install'
import { makePlugin } from '../../../test/fixtures'

describe('batchInstallable', () => {
  it('excludes installed and deactivated plugins, keeps the rest', () => {
    const spoolman = makePlugin({ id: 'spoolman' })
    expect(batchInstallable(spoolman, [], [])).toBe(true)
    expect(batchInstallable(spoolman, ['spoolman'], [])).toBe(false)
    expect(batchInstallable(spoolman, [], ['spoolman'])).toBe(false)
  })

  it('installablePlugins filters the catalog by the same rule', () => {
    const plugins = [makePlugin({ id: 'a' }), makePlugin({ id: 'b' }), makePlugin({ id: 'c' })]
    expect(installablePlugins(plugins, ['a'], ['c']).map((entry) => entry.id)).toEqual(['b'])
  })
})

describe('pluginsNeedingConfig', () => {
  const spoolman = makePlugin({ id: 'spoolman', config: [{ key: 'SPOOLMAN_SERVER', label: 'Server', type: 'text', scope: 'global', required: true }] })
  const cpuTemp = makePlugin({ id: 'cpu-temp' })

  it('flags a plugin whose required field has no saved value or default', () => {
    expect(pluginsNeedingConfig([spoolman, cpuTemp], {}).map((entry) => entry.id)).toEqual(['spoolman'])
  })

  it('does not flag it once the required value is saved', () => {
    expect(pluginsNeedingConfig([spoolman], { SPOOLMAN_SERVER: 'printer.local' })).toEqual([])
  })

  it('does not flag a required field that carries a usable default', () => {
    const withDefault = makePlugin({ id: 'mainsail', config: [{ key: 'PORT', label: 'Port', type: 'text', scope: 'global', required: true, default: '81' }] })
    expect(pluginsNeedingConfig([withDefault], {})).toEqual([])
  })
})

describe('initialBatchValues', () => {
  it('pre-fills every field across the plugins, saved value winning over default', () => {
    const plugins = [
      makePlugin({ id: 'spoolman', config: [{ key: 'SERVER', label: 'Server', type: 'text', scope: 'global', default: 'localhost' }] }),
      makePlugin({ id: 'auth', config: [{ key: 'FORCE', label: 'Force', type: 'text', scope: 'global', default: 'false' }] }),
    ]
    expect(initialBatchValues(plugins, { SERVER: 'printer.local' })).toEqual({ SERVER: 'printer.local', FORCE: 'false' })
  })
})

describe('buildInstallSpecs', () => {
  it('emits one spec per selected plugin with its config values and missing deps', () => {
    const plugins = [
      makePlugin({ id: 'leaf', deps: ['core'], config: [{ key: 'OPT', label: 'Opt', type: 'text', scope: 'global', default: 'd' }] }),
      makePlugin({ id: 'core' }),
      makePlugin({ id: 'unpicked' }),
    ]
    const specs = buildInstallSpecs(plugins, ['leaf'], [], {})
    expect(specs).toEqual([{ pluginId: 'leaf', vars: { OPT: 'd' }, depIds: ['core'] }])
  })

  it('drops an already-installed dependency from the spec', () => {
    const plugins = [makePlugin({ id: 'leaf', deps: ['core'] }), makePlugin({ id: 'core' })]
    expect(buildInstallSpecs(plugins, ['leaf'], ['core'], {})).toEqual([{ pluginId: 'leaf', vars: {}, depIds: [] }])
  })
})
