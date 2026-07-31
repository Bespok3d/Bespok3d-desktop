// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A list served as zero bytes reached us perfectly well, so reporting it as a transport failure sends
// the reader off to check a connection that is not broken. The publisher's end is where an empty list
// comes from, and that is what these pin.
import { describe, it, expect, vi } from 'vitest'
import { RegistryFetchError } from '../model'
import type { RegistryRef, ServedIndex } from '../model'
import { toFetchedRegistry } from './served-index'

// Mocking these two with factories keeps ../../app-paths (and with it electron) out of the run.
vi.mock('./cache', () => ({ writeCache: vi.fn() }))
vi.mock('./verify', () => ({ verifyIndexSignature: () => Promise.resolve({ proof: 'unsigned' }) }))

const REF: RegistryRef = { url: 'https://lists.example.invalid/index.json', trust: 'community', locked: false }

function served(bytes: string): ServedIndex {
  return { bytes, signature: null }
}

async function failureFrom(bytes: string): Promise<RegistryFetchError> {
  const thrown = await toFetchedRegistry(REF, served(bytes), false).catch((error: RegistryFetchError) => error)
  expect(thrown).toBeInstanceOf(RegistryFetchError)

  return thrown as RegistryFetchError
}

describe('a list that came back with nothing in it', () => {
  it('is called empty rather than a network failure', async () => {
    expect((await failureFrom('')).reason).toBe('empty')
  })

  it('is still called empty when the bytes are only whitespace', async () => {
    expect((await failureFrom('\n  \n')).reason).toBe('empty')
  })

  it('stays apart from bytes that arrived and are not a list', async () => {
    expect((await failureFrom('<html>captive portal</html>')).reason).toBe('network')
  })

  it('lets a real list through', async () => {
    const bytes = JSON.stringify({ schema_version: 1, name: 'Fixture List', publisher: 'PLACEHOLDER', updated: '2026-01-01', plugins: [], lists: [] })
    const fetched = await toFetchedRegistry(REF, served(bytes), false)
    expect(fetched.index.name).toBe('Fixture List')
  })
})
