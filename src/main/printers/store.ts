import { join } from 'path'
import { writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'fs'
import { readJsonFile } from '../json-store'
import { userDataPath } from '../app-paths'
import type { PrinterRecord, PublicPrinterRecord } from './record'
import { toPublicRecord } from './record'

function printersDir(): string {
  const dir = userDataPath('printers')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  return dir
}

function printerFilePath(id: string): string {
  return join(printersDir(), `${id}.json`)
}

export function savePrinter(record: PrinterRecord): void {
  writeFileSync(printerFilePath(record.id), JSON.stringify(record, null, 2), 'utf-8')
}

export function loadPrinters(): PrinterRecord[] {
  const dir = printersDir()

  return readdirSync(dir)
    .filter((filename) => filename.endsWith('.json'))
    .map((filename) => readJsonFile<PrinterRecord | null>(join(dir, filename), null))
    .filter((record): record is PrinterRecord => record !== null)
}

// The renderer-facing load: every record with its daemon credentials stripped. The `printers:load`
// IPC uses this so the secrets never reach the renderer; main-side callers use loadPrinters.
export function loadPublicPrinters(): PublicPrinterRecord[] {
  return loadPrinters().map(toPublicRecord)
}

export function loadPrinter(id: string): PrinterRecord | null {
  return readJsonFile<PrinterRecord | null>(printerFilePath(id), null)
}

type PrinterPatch = Partial<PrinterRecord> | ((current: PrinterRecord) => Partial<PrinterRecord>)

// Field-level merge write: re-read the record at write time and merge only the patched fields, so two
// near-simultaneous updates on different fields never clobber each other (the status ping and a plugin
// install race exactly like that). Read-merge-write runs with no await between, so it is atomic against
// the event loop. The function form receives the freshly read record, so a patch derived from existing
// fields (provenance maps, the original enrolled-at) also merges onto current state, not a stale
// snapshot a long op captured before its awaits. Returns the merged record, or null when the printer
// was removed before the write.
export function updatePrinter(id: string, patch: PrinterPatch): PrinterRecord | null {
  const record = loadPrinter(id)
  if (!record) return null
  const fields = typeof patch === 'function' ? patch(record) : patch
  const merged = { ...record, ...fields }
  savePrinter(merged)

  return merged
}

export function removePrinter(id: string): void {
  const filePath = printerFilePath(id)
  if (existsSync(filePath)) rmSync(filePath)
}
