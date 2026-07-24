import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { devSourcesRoot, devSourcePath } from './dev-sources'

const savedEnv = process.env.B3D_DEV_SOURCES

afterEach(() => {
  if (savedEnv === undefined) delete process.env.B3D_DEV_SOURCES
  else process.env.B3D_DEV_SOURCES = savedEnv
})

describe('devSourcesRoot', () => {
  it('is undefined when the variable is unset or empty', () => {
    delete process.env.B3D_DEV_SOURCES
    expect(devSourcesRoot()).toBeUndefined()
    process.env.B3D_DEV_SOURCES = ''
    expect(devSourcesRoot()).toBeUndefined()
  })

  it('returns the workspace root when set', () => {
    process.env.B3D_DEV_SOURCES = '/work/bespok3d-dev'
    expect(devSourcesRoot()).toBe('/work/bespok3d-dev')
  })
})

describe('devSourcePath', () => {
  it('returns undefined when no workspace is configured', () => {
    delete process.env.B3D_DEV_SOURCES
    expect(devSourcePath('daemon')).toBeUndefined()
  })

  it('returns the joined path only when it exists under the workspace', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'b3d-dev-'))
    mkdirSync(join(workspace, 'daemon'))
    process.env.B3D_DEV_SOURCES = workspace
    expect(devSourcePath('daemon')).toBe(join(workspace, 'daemon'))
  })

  it('falls through (undefined) when the path is absent, so a partial workspace still works', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'b3d-dev-'))
    process.env.B3D_DEV_SOURCES = workspace
    expect(devSourcePath('adapters/snapmaker-u1/jinni')).toBeUndefined()
  })
})
