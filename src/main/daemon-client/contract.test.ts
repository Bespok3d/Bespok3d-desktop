// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import fixture from './__fixtures__/daemon-contract.json'
import type { CapabilitiesResult, DaemonStatusResult, Endpoint, InstallLogItem, InstallLogPhase, PluginConfigResult } from '@bespok3d/contract'

// The app<->daemon JSON contract, pinned in one place. The daemon emits these shapes; the app parses
// them raw off the wire (client.ts) into the @bespok3d/contract interfaces. The committed fixture is
// the golden sample the daemon generates from its Pydantic models (daemon/tests/api/test_contract_fixture.py).
//
// Two guards close the loop so a field renamed on EITHER side fails a test rather than drifting:
//   1. type-level `satisfies` below pins the fixture to @bespok3d/contract (a rename there fails tsc);
//   2. the runtime deep-equal pins the committed copy to the live daemon fixture (a daemon schema
//      change that regenerates its fixture, not copied here, fails this test).
// The daemon's own test pins that fixture to its Pydantic models. The live over-the-wire backstop is
// the Docker in-vitro lifecycle suite; this is the fast, no-Docker static complement.

// Compile-time pin: each wire section must satisfy its contract interface. tsc -b checks this file.
const capabilities = fixture.capabilities satisfies CapabilitiesResult
const installLog = fixture.install.log satisfies InstallLogPhase[]
const reconfigureLog = fixture.reconfigure.log satisfies InstallLogPhase[]
const recoveryLog = fixture.recover.results[0].log satisfies InstallLogPhase[]
const endpoints = fixture.capabilities.endpoints satisfies Endpoint[]
const firstItem = fixture.install.log[0].items[0] satisfies InstallLogItem
const daemonStatus = fixture.status satisfies DaemonStatusResult
const pluginConfig = fixture.plugin_config satisfies PluginConfigResult

describe('app<->daemon contract fixture', () => {
  it('matches the live daemon-generated golden fixture (no copy drift)', () => {
    const daemonFixturePath = fileURLToPath(
      new URL('../../../../daemon/tests/api/contract_fixture.json', import.meta.url),
    )
    const daemonFixture = JSON.parse(readFileSync(daemonFixturePath, 'utf-8'))
    expect(daemonFixture, 'app copy must equal daemon/tests/api/contract_fixture.json').toEqual(fixture)
  })

  it('carries the wire shapes the app parses raw', () => {
    expect(endpoints[0]).toEqual({ label: 'Spoolman', url: 'http://{host}:7912' })
    expect(firstItem).toMatchObject({ label: expect.any(String), ok: expect.any(Boolean) })
    expect(installLog[0]).toMatchObject({ id: expect.any(String), items: expect.any(Array) })
    expect(reconfigureLog).toEqual(installLog)
    expect(recoveryLog).toEqual(installLog)
    expect(capabilities.adapter).toBe('snapmaker-u1')
    expect(daemonStatus).toMatchObject({ ok: true, printer_uuid: expect.any(String) })
    expect(pluginConfig.vars).toMatchObject({ SPOOLMAN_SERVER: expect.any(String) })
  })
})
