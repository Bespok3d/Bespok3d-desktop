import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('electron', () => ({ app: { getPath: vi.fn() } }))
vi.mock('net', () => ({ createConnection: vi.fn() }))

import { savePrinter, loadPrinters, removePrinter, checkDaemon, updatePrinter } from './printers'
import { toPublicRecord, loadPublicPrinters } from './printers'
import { mergeCapture, appendPluginCapture, pluginCaptures } from './printers'
import { createConnection } from 'net'
import type { PrinterRecord } from './printers'
import { app } from 'electron'

const mockGetPath = vi.mocked(app.getPath)
const mockCreateConnection = vi.mocked(createConnection)

function makeSocket(event: 'connect' | 'timeout' | 'error') {
  const handlers: Record<string, (...args: unknown[]) => void> = {}
  const socket = {
    on: vi.fn().mockImplementation((evt: string, cb: (...args: unknown[]) => void) => {
      handlers[evt] = cb

      return socket
    }),
    destroy: vi.fn(),
  }
  mockCreateConnection.mockImplementation(() => {
    Promise.resolve().then(() => {
      if (event === 'error') handlers[event]?.(new Error('refused'))
      else handlers[event]?.()
    })

    return socket as unknown as ReturnType<typeof createConnection>
  })

  return socket
}

const SAMPLE_PRINTER: PrinterRecord = {
  id: 'test-printer-001',
  nick: 'Workshop U1',
  model: 'snapmaker-u1',
  adapter: 'snapmaker-u1',
  host: 'printer.local',
  ip: '192.168.1.42',
  status: 'online',
  installedIds: [],
}

// Point the store at a fresh tmp dir per test (the suites use the real fs over a mocked userData path).
// Returns an accessor for the userData dir so a test can plant a file the store will read.
function useTempPrintersDir() {
  var testDir: string
  beforeEach(() => { testDir = mkdtempSync(join(tmpdir(), 'b3-printers-')); mockGetPath.mockReturnValue(testDir) })
  afterEach(() => { rmSync(testDir, { recursive: true, force: true }) })

  return () => testDir
}

describe('printer persistence: corrupt file resilience', () => {
  const dir = useTempPrintersDir()

  it('skips a corrupt printer file and still loads the valid records', () => {
    savePrinter(SAMPLE_PRINTER)
    writeFileSync(join(dir(), 'printers', 'broken.json'), '{ not valid json')

    const loaded = loadPrinters()

    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe(SAMPLE_PRINTER.id)
  })
})

describe('printer persistence: CRUD', () => {
  useTempPrintersDir()

  it('loadPrinters returns an empty array when no printers are stored', () => {
    expect(loadPrinters()).toEqual([])
  })

  it('savePrinter persists a record that loadPrinters returns', () => {
    savePrinter(SAMPLE_PRINTER)
    const loaded = loadPrinters()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].id).toBe('test-printer-001')
  })

  it('savePrinter overwrites the same id with updated fields', () => {
    savePrinter(SAMPLE_PRINTER)
    savePrinter({ ...SAMPLE_PRINTER, status: 'managed' })
    expect(loadPrinters()[0].status).toBe('managed')
  })

  it('removePrinter deletes the record so it no longer appears in loadPrinters', () => {
    savePrinter(SAMPLE_PRINTER)
    removePrinter(SAMPLE_PRINTER.id)
    expect(loadPrinters()).toHaveLength(0)
  })

  it('removePrinter is a no-op when the id does not exist', () => {
    expect(() => removePrinter('nonexistent-id')).not.toThrow()
  })
})

describe('printer persistence: field fidelity', () => {
  useTempPrintersDir()

  it('savePrinter and loadPrinters round-trip all PrinterRecord fields faithfully', () => {
    const fullRecord: PrinterRecord = {
      ...SAMPLE_PRINTER,
      status: 'managed',
      iconColor: '#ff6600',
      iconImage: 'printer',
      enrollmentLog: {
        enrolledAt: '2026-05-24T00:00:00Z',
        adapterId: 'snapmaker-u1',
        steps: [{ id: 'verify', label: 'Verified', detail: 'All good' }],
      },
      daemonToken: 'abc123',
      daemonCert: '-----BEGIN CERTIFICATE-----\nstub\n-----END CERTIFICATE-----',
    }
    savePrinter(fullRecord)
    const loaded = loadPrinters()[0]
    expect(loaded.enrollmentLog?.adapterId).toBe('snapmaker-u1')
    expect(loaded.iconColor).toBe('#ff6600')
    expect(loaded.daemonToken).toBe('abc123')
    expect(loaded.daemonCert).toContain('BEGIN CERTIFICATE')
  })
})

describe('updatePrinter: field-level merge (no clobber)', () => {
  useTempPrintersDir()

  it('two interleaved field updates from different flows both survive', async () => {
    savePrinter({ ...SAMPLE_PRINTER, status: 'online', installedIds: [] })
    // The status ping and a plugin install each yield to the event loop before writing a different
    // field. The field-level merge re-reads at write time, so neither flow clobbers the other.
    async function pingFlow() { await Promise.resolve(); updatePrinter(SAMPLE_PRINTER.id, { status: 'managed' }) }
    async function installFlow() { await Promise.resolve(); updatePrinter(SAMPLE_PRINTER.id, { installedIds: ['spoolman'] }) }
    await Promise.all([pingFlow(), installFlow()])
    const saved = loadPrinters()[0]
    expect(saved.status).toBe('managed')
    expect(saved.installedIds).toEqual(['spoolman'])
  })

  it('the whole-record read-modify-write clobbers a concurrent field (the bug being fixed)', async () => {
    savePrinter({ ...SAMPLE_PRINTER, status: 'online', installedIds: [] })
    async function pingFlow() {
      const record = loadPrinters()[0]
      await Promise.resolve()
      savePrinter({ ...record, status: 'managed' })
    }
    async function installFlow() {
      const record = loadPrinters()[0]
      await Promise.resolve()
      savePrinter({ ...record, installedIds: ['spoolman'] })
    }
    await Promise.all([pingFlow(), installFlow()])
    const saved = loadPrinters()[0]
    expect(saved.status === 'managed' && saved.installedIds.length === 1).toBe(false)
  })

})

describe('updatePrinter: merge semantics', () => {
  useTempPrintersDir()

  it('the function form patches against the freshly read record, keeping a concurrent field', () => {
    savePrinter({ ...SAMPLE_PRINTER, installedSources: { spoolman: 'url-a' } })
    savePrinter({ ...loadPrinters()[0], status: 'managed' })
    const merged = updatePrinter(SAMPLE_PRINTER.id, (current) => ({
      installedSources: { ...current.installedSources, fluidd: 'url-b' },
    }))
    expect(merged?.installedSources).toEqual({ spoolman: 'url-a', fluidd: 'url-b' })
    expect(merged?.status).toBe('managed')
  })

  it('returns null for an unknown printer and writes nothing', () => {
    expect(updatePrinter('ghost', { status: 'managed' })).toBeNull()
    expect(loadPrinters()).toEqual([])
  })
})

describe('toPublicRecord: redacts daemon secrets for the renderer', () => {
  const dir = useTempPrintersDir()

  const enrolled: PrinterRecord = {
    ...SAMPLE_PRINTER,
    status: 'managed',
    daemonToken: 'secret-token',
    daemonCert: '-----BEGIN CERTIFICATE-----\nstub\n-----END CERTIFICATE-----',
    accessIdentity: 'fingerprint-123',
    installedVersions: { spoolman: '0.1.8' },
  }

  it('omits daemonToken, daemonCert and accessIdentity but keeps every other field', () => {
    const view = toPublicRecord(enrolled)
    expect(view).not.toHaveProperty('daemonToken')
    expect(view).not.toHaveProperty('daemonCert')
    expect(view).not.toHaveProperty('accessIdentity')
    expect(view.id).toBe(enrolled.id)
    expect(view.status).toBe('managed')
    expect(view.installedVersions).toEqual({ spoolman: '0.1.8' })
  })

  it('loadPublicPrinters never hands the renderer a secret the disk record still holds', () => {
    void dir()
    savePrinter(enrolled)
    const loaded = loadPublicPrinters()
    expect(loaded[0]).not.toHaveProperty('daemonToken')
    expect(loaded[0]).not.toHaveProperty('daemonCert')
    expect(loaded[0].id).toBe(enrolled.id)
    expect(loadPrinters()[0].daemonToken).toBe('secret-token')
  })
})

describe('mergeCapture', () => {
  it('appends a new value newest-last', () => {
    expect(mergeCapture(['a'], 'b', 50)).toEqual(['a', 'b'])
  })

  it('keeps a duplicate in place without re-adding it', () => {
    expect(mergeCapture(['a', 'b'], 'a', 50)).toEqual(['a', 'b'])
  })

  it('drops the oldest past the cap', () => {
    expect(mergeCapture(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd'])
  })
})

describe('appendPluginCapture', () => {
  useTempPrintersDir()

  it('persists captures per plugin and reads them back, deduped', () => {
    savePrinter(SAMPLE_PRINTER)
    appendPluginCapture(SAMPLE_PRINTER.id, 'octoeverywhere', 'https://oe.example/link')
    appendPluginCapture(SAMPLE_PRINTER.id, 'octoeverywhere', 'https://oe.example/link')
    appendPluginCapture(SAMPLE_PRINTER.id, 'spoolman', 'https://other.example')
    expect(pluginCaptures(SAMPLE_PRINTER.id, 'octoeverywhere')).toEqual(['https://oe.example/link'])
    expect(pluginCaptures(SAMPLE_PRINTER.id, 'spoolman')).toEqual(['https://other.example'])
  })

  it('returns an empty list for an unknown printer', () => {
    expect(appendPluginCapture('ghost', 'octoeverywhere', 'x')).toEqual([])
  })
})

describe('checkDaemon', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('resolves true when TCP connect succeeds on port 4269', async () => {
    makeSocket('connect')
    const result = await checkDaemon('1.2.3.4')
    expect(result).toBe(true)
    expect(mockCreateConnection).toHaveBeenCalledWith(
      expect.objectContaining({ host: '1.2.3.4', port: 4269 })
    )
  })

  it('resolves false when connection errors', async () => {
    makeSocket('error')
    expect(await checkDaemon('1.2.3.4')).toBe(false)
  })

  it('resolves false on timeout', async () => {
    makeSocket('timeout')
    expect(await checkDaemon('1.2.3.4')).toBe(false)
  })
})
