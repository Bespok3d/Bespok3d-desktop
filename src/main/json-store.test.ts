import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { readJsonFile } from './json-store'

describe('readJsonFile', () => {
  var dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'b3-json-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('parses valid JSON from disk', () => {
    const path = join(dir, 'ok.json')
    writeFileSync(path, JSON.stringify({ count: 7 }))
    expect(readJsonFile(path, { count: 0 })).toEqual({ count: 7 })
  })

  it('returns the fallback when the file is missing', () => {
    expect(readJsonFile(join(dir, 'absent.json'), { safe: true })).toEqual({ safe: true })
  })

  it('returns the fallback when the file holds corrupt JSON', () => {
    const path = join(dir, 'broken.json')
    writeFileSync(path, '{ not valid json')
    expect(readJsonFile(path, 'fallback')).toBe('fallback')
  })
})
