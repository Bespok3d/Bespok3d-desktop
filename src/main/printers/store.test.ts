// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

var appDataDir = ''

vi.mock('../app-paths', () => ({ userDataPath: (...segments: string[]) => join(appDataDir, ...segments) }))

import { loadPrinters, loadPrinter } from './store'

function savedPrinterFile(record: Record<string, unknown>): void {
  const dir = join(appDataDir, 'printers')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${record.id as string}.json`), JSON.stringify(record), 'utf-8')
}

beforeEach(() => { appDataDir = mkdtempSync(join(tmpdir(), 'b3d-printers-')) })
afterEach(() => rmSync(appDataDir, { recursive: true, force: true }))

// The repair-vs-recover verdict is a live measurement of the printer, and the printer can be reflashed
// while the app is closed. Kept in the saved record, it came back at the next start as if it had just
// been taken, and the app went on offering Repair on a printer only full recovery can rebuild.
describe('a printer record saved before the verdict stopped being stored', () => {
  it('leaves the stored write-layer verdict behind, so the printer is asked again', () => {
    savedPrinterFile({ id: 'printer-1', nick: 'unU1Jr', adapter: 'snapmaker-u1', installedIds: [], writeLayerIntact: true })

    expect(loadPrinters()[0]).not.toHaveProperty('writeLayerIntact')
    expect(loadPrinter('printer-1')).not.toHaveProperty('writeLayerIntact')
  })

  it('keeps everything else the record carries', () => {
    savedPrinterFile({ id: 'printer-1', nick: 'unU1Jr', adapter: 'snapmaker-u1', installedIds: ['camera'], writeLayerIntact: true })
    const loaded = loadPrinters()[0]

    expect(loaded.nick).toBe('unU1Jr')
    expect(loaded.installedIds).toEqual(['camera'])
  })
})
