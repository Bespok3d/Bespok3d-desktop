// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
// @ts-expect-error - build-time generator, plain JS with no type declarations
import { buildIndex } from '../../../../scripts/app-bundle.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildLocalIndex, DAEMON_SERVED_SERVICES } from './build-index'
import { CPU_TEMP_MANIFEST as FULL } from './manifest-fixture'

const DAEMON_SERVICES_SOURCE = fileURLToPath(new URL('../../../../../daemon/core/packages/daemon_services.py', import.meta.url))

// The daemon names its served capabilities as `CONST = "service-name"` and puts the constants it
// actually serves in `DAEMON_SERVICES = frozenset({...})`. Read the pair, so a name defined but not
// yet served is not counted.
function daemonServedServiceNames(): string[] {
  const source = readFileSync(DAEMON_SERVICES_SOURCE, 'utf8')
  const nameByConstant = new Map(Array.from(source.matchAll(/^([A-Z_]+) = "([a-z0-9-]+)"$/gm)).map((match) => [match[1], match[2]]))
  const served = source.slice(source.indexOf('DAEMON_SERVICES'))

  return Array.from(nameByConstant.keys())
    .filter((constant) => served.includes(constant))
    .map((constant) => nameByConstant.get(constant) as string)
}

describe('buildLocalIndex', () => {
  it('produces the same plugin entries as the bundled buildIndex (no drift)', () => {
    const local = buildLocalIndex([FULL as never]) as { plugins: unknown[] }
    const bundled = buildIndex([FULL]) as { plugins: unknown[] }
    expect(local.plugins).toEqual(bundled.plugins)
  })

  it('falls back gracefully on a metadata-thin manifest', () => {
    const thin = { name: 'mini', version: '0.0.1', install: {} }
    const entry = (buildLocalIndex([thin as never]) as { plugins: Record<string, unknown>[] }).plugins[0]
    expect(entry.title).toBe('mini')
    expect(entry.download_url).toBe('mini-0.0.1.b3')
    expect(entry.category).toBe('other')
  })
})

describe('daemon-served services', () => {
  it('never resolve to a store dep, because no plugin can provide one', () => {
    const requiresDaemonService = { name: 'needs-daemon', version: '0.0.1', install: {}, require: [{ service: 'migrate-patch' }] }
    const entry = (buildLocalIndex([requiresDaemonService as never]) as { plugins: Record<string, unknown>[] }).plugins[0]
    expect(entry.deps).toEqual([])
    expect((buildIndex([requiresDaemonService]) as { plugins: Record<string, unknown>[] }).plugins[0].deps).toEqual([])
  })

  it('match the daemon that serves them (no drift)', () => {
    if (!existsSync(DAEMON_SERVICES_SOURCE)) return
    expect(daemonServedServiceNames().sort()).toEqual(Array.from(DAEMON_SERVED_SERVICES).sort())
  })
})
