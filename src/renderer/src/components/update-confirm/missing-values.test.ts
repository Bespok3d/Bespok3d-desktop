// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { makePlugin, makeSource } from '../../test/fixtures'
import type { PluginConfigField } from '../../data/types'
import type { UpdateAllPlan } from '../plugin-store/migrations'
import { planSpecs } from '../plugin-store/migrations'
import { batchPlugins, knownPluginValues, planWithCapturedValues, pluginsMissingValues, pluginsToAskThePrinter } from './missing-values'
import type { PrinterPluginValues } from './missing-values'

const FREEZE_RECOVERY: PluginConfigField = { key: 'CAMERA_FREEZE_RECOVERY', label: 'Freeze recovery', type: 'text', scope: 'printer', required: true }
const CAMERA = makePlugin({ id: 'camera', config: [FREEZE_RECOVERY] })
const CAMERA_WITH_DEFAULT = makePlugin({ id: 'camera', config: [{ ...FREEZE_RECOVERY, default: '1' }] })
const TESTING_URL = 'github:example/testing-index/index.json'
const CAMERA_TWO_BUILDS = makePlugin({
  id: 'camera', config: [],
  sources: [makeSource({ config: [] }), makeSource({ registryUrl: TESTING_URL, channel: 'testing', config: [FREEZE_RECOVERY] })],
})

function planOf(updates: PluginUpdateSpec[], arrivingSpecs: PluginUpdateSpec[] = []): UpdateAllPlan {
  const migrations = arrivingSpecs.length === 0 ? [] : [{ arrivingSpecs }] as unknown as UpdateAllPlan['migrations']

  return { updates, migrations }
}

function missingFor(specs: PluginUpdateSpec[], catalogPlugins: ReturnType<typeof makePlugin>[], printerValues: PrinterPluginValues) {
  const plugins = batchPlugins(specs, catalogPlugins)

  return pluginsMissingValues(plugins, knownPluginValues(specs, plugins, printerValues)).map((plugin) => plugin.id)
}

describe('the values an Update all still needs', () => {
  it('names a plugin whose required setting has no value anywhere', () => {
    expect(missingFor([{ pluginId: 'camera', vars: {} }], [CAMERA], { camera: {} })).toEqual(['camera'])
  })

  it('takes the value the printer already runs', () => {
    expect(missingFor([{ pluginId: 'camera', vars: {} }], [CAMERA], { camera: { CAMERA_FREEZE_RECOVERY: '1' } })).toEqual([])
  })

  it('asks for a required setting that has only a default, because main never sends that placeholder', () => {
    expect(missingFor([{ pluginId: 'camera' }], [CAMERA_WITH_DEFAULT], { camera: {} })).toEqual(['camera'])
  })

  it('asks when the printer did not answer, because the batch then sends no default', () => {
    expect(missingFor([{ pluginId: 'camera' }], [CAMERA_WITH_DEFAULT], { camera: 'unreadable' })).toEqual(['camera'])
  })

  it('counts a blank value as missing', () => {
    expect(missingFor([{ pluginId: 'camera', vars: { CAMERA_FREEZE_RECOVERY: '  ' } }], [CAMERA], { camera: {} })).toEqual(['camera'])
  })

  it('reads the settings of the build the batch installs', () => {
    expect(missingFor([{ pluginId: 'camera', sourceUrl: TESTING_URL, channel: 'testing' }], [CAMERA_TWO_BUILDS], { camera: {} })).toEqual(['camera'])
    expect(missingFor([{ pluginId: 'camera' }], [CAMERA_TWO_BUILDS], { camera: {} })).toEqual([])
  })

  it('asks the printer only about plugins the batch gives no value for', () => {
    const plugins = [CAMERA, makePlugin({ id: 'light', config: [{ ...FREEZE_RECOVERY, key: 'LIGHT_PIN' }] })]
    const specs = [{ pluginId: 'camera', vars: { CAMERA_FREEZE_RECOVERY: '1' } }, { pluginId: 'light' }]

    expect(pluginsToAskThePrinter(specs, batchPlugins(specs, plugins))).toEqual(['light'])
  })

  it('checks the plugins arriving with a set too', () => {
    const plan = planOf([], [{ pluginId: 'camera' }])

    expect(planSpecs(plan)).toEqual([{ pluginId: 'camera' }])
  })

  it('puts the given values in the updates and the arriving plugins', () => {
    const plan = planOf([{ pluginId: 'camera', vars: { OTHER: 'kept' } }], [{ pluginId: 'camera' }])
    const filled = planWithCapturedValues(plan, { camera: { CAMERA_FREEZE_RECOVERY: '1' } })

    expect(planSpecs(filled)).toEqual([
      { pluginId: 'camera', vars: { OTHER: 'kept', CAMERA_FREEZE_RECOVERY: '1' } },
      { pluginId: 'camera', vars: { CAMERA_FREEZE_RECOVERY: '1' } },
    ])
  })
})
