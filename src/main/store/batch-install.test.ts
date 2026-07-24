import { describe, it, expect } from 'vitest'
import { recordBatchOutcome, batchOkVersions } from './batch-install'
import type { BatchEvidence } from './batch-install'
import type { RecoverResult, PluginRecoveryResult } from '@bespok3d/contract'
import type { MergedEntry, PackageTrust } from '../registry/model'
import type { PrinterRecord } from '../printers'

function entry(over: Partial<MergedEntry>): MergedEntry {
  return { name: 'p', version: '1.0.0', registry_url: 'official', channel: 'stable', ...over } as MergedEntry
}

function pluginResult(over: Partial<PluginRecoveryResult>): PluginRecoveryResult {
  return { pluginId: 'p', ok: true, skipped: false, reason: '', log: [], ...over }
}

function emptyRecord(over: Partial<PrinterRecord> = {}): PrinterRecord {
  return { installedSources: {}, installedChannels: {}, installLogs: {}, installedVersions: {}, ...over } as PrinterRecord
}

const NO_VARS = new Map<string, Record<string, string> | undefined>()

function evidence(entryById: Map<string, MergedEntry>, trustById = new Map<string, PackageTrust>()): BatchEvidence {
  return { entryById, trustById }
}

describe('recordBatchOutcome', () => {
  it('records source/channel/log for OK plugins and skips the failed ones', () => {
    const entryById = new Map<string, MergedEntry>([
      ['good', entry({ name: 'good', version: '2.0.0', registry_url: 'src-a', channel: 'stable' })],
      ['bad', entry({ name: 'bad' })],
    ])
    const result: RecoverResult = { ok: false, results: [
      pluginResult({ pluginId: 'good', ok: true }),
      pluginResult({ pluginId: 'bad', ok: false, reason: 'failed' }),
    ] }

    const outcome = recordBatchOutcome(emptyRecord(), result, evidence(entryById), 123, NO_VARS)

    expect(outcome.installedSources).toEqual({ good: 'src-a' })
    expect(outcome.installedChannels).toEqual({ good: 'stable' })
    expect(outcome.installLogs.good).toEqual({ pluginId: 'good', timestamp: 123, ok: true, phases: [] })
    expect(outcome.installLogs.bad).toBeUndefined()
  })

  it('merges onto the record existing maps, never dropping prior entries', () => {
    const record = emptyRecord({ installedSources: { older: 'x' } })
    const entryById = new Map<string, MergedEntry>([['fresh', entry({ name: 'fresh', registry_url: 'y' })]])
    const result: RecoverResult = { ok: true, results: [pluginResult({ pluginId: 'fresh', ok: true })] }

    expect(recordBatchOutcome(record, result, evidence(entryById), 1, NO_VARS).installedSources).toEqual({ older: 'x', fresh: 'y' })
  })
})

describe('recordBatchOutcome package trust', () => {
  it('records the tier each OK package earned, leaving an unverified plugin absent rather than unknown', () => {
    const entryById = new Map<string, MergedEntry>([['signed', entry({ name: 'signed' })], ['unchecked', entry({ name: 'unchecked' })]])
    const trustById = new Map<string, PackageTrust>([['signed', 'project']])
    const result: RecoverResult = { ok: true, results: [
      pluginResult({ pluginId: 'signed', ok: true }),
      pluginResult({ pluginId: 'unchecked', ok: true }),
    ] }

    const outcome = recordBatchOutcome(emptyRecord(), result, evidence(entryById, trustById), 1, NO_VARS)

    expect(outcome.installedPackageTrust).toEqual({ signed: 'project' })
  })
})

describe('recordBatchOutcome applied vars', () => {
  it('records applied vars for user-picked specs only, not auto-added deps, with the batch timestamp', () => {
    const entryById = new Map<string, MergedEntry>([
      ['spoolman', entry({ name: 'spoolman' })],
      ['rfid-ntag', entry({ name: 'rfid-ntag' })],
    ])
    const result: RecoverResult = { ok: true, results: [
      pluginResult({ pluginId: 'rfid-ntag', ok: true }),
      pluginResult({ pluginId: 'spoolman', ok: true }),
    ] }
    const varsBySpecId = new Map<string, Record<string, string> | undefined>([['spoolman', { SPOOLMAN_SERVER: 'http://x' }]])

    const outcome = recordBatchOutcome(emptyRecord(), result, evidence(entryById), 1751450000000, varsBySpecId)

    expect(outcome.appliedPluginVars).toEqual({ spoolman: { SPOOLMAN_SERVER: 'http://x' } })
    expect(outcome.appliedPluginVarsAt.spoolman).toBe(new Date(1751450000000).toISOString())
    expect(outcome.appliedPluginVars['rfid-ntag']).toBeUndefined()
  })

  it('records a spec sent without vars as the empty map, and skips a failed spec plugin', () => {
    const entryById = new Map<string, MergedEntry>([['good', entry({ name: 'good' })], ['bad', entry({ name: 'bad' })]])
    const result: RecoverResult = { ok: false, results: [
      pluginResult({ pluginId: 'good', ok: true }),
      pluginResult({ pluginId: 'bad', ok: false, reason: 'failed' }),
    ] }
    const varsBySpecId = new Map<string, Record<string, string> | undefined>([['good', undefined], ['bad', { SERVER_URL: 'http://x' }]])

    const outcome = recordBatchOutcome(emptyRecord(), result, evidence(entryById), 1, varsBySpecId)

    expect(outcome.appliedPluginVars).toEqual({ good: {} })
    expect(outcome.appliedPluginVarsAt.bad).toBeUndefined()
  })
})

describe('batchOkVersions', () => {
  it('returns versions for OK plugins with an entry only', () => {
    const entryById = new Map<string, MergedEntry>([['good', entry({ name: 'good', version: '2.0.0' })]])
    const result: RecoverResult = { ok: false, results: [
      pluginResult({ pluginId: 'good', ok: true }),
      pluginResult({ pluginId: 'bad', ok: false }),
      pluginResult({ pluginId: 'unknown', ok: true }),
    ] }

    expect(batchOkVersions(result, entryById)).toEqual({ good: '2.0.0' })
  })
})
