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

// The walk that loads every source reads the plugins, the sub-lists and the collections straight off
// this object. A source that serves JSON of any other shape used to reach that walk and throw inside
// it, which killed the load of every OTHER list the owner has. These pin that it is refused at its own
// source, so the rest of the store still loads.
describe('a source that answers with JSON that is not a plugin list', () => {
  it('refuses a list with no plugins in it', async () => {
    const bytes = JSON.stringify({ schema_version: 1, name: 'Fixture List', updated: '2026-01-01' })
    expect((await failureFrom(bytes)).message).toMatch(/no plugins in it/)
  })

  it('refuses plugins served as something other than a list', async () => {
    const bytes = JSON.stringify({ schema_version: 1, name: 'Fixture List', plugins: 'everything' })
    expect((await failureFrom(bytes)).message).toMatch(/no plugins in it/)
  })

  it('refuses a bare array, a bare string and a bare null', async () => {
    const shapes = ['[]', '"a list"', 'null', '42']
    const refusals = await Promise.all(shapes.map((bytes) => failureFrom(bytes)))
    refusals.forEach((refusal) => expect(refusal.message).toMatch(/not in the shape of a plugin list/))
  })

  it('refuses sub-lists served as something other than a list', async () => {
    const bytes = JSON.stringify({ schema_version: 1, name: 'Fixture List', plugins: [], lists: { all: 'of them' } })
    expect((await failureFrom(bytes)).message).toMatch(/sub-lists in a shape that cannot be read/)
  })

  it('refuses collections served as something other than a list', async () => {
    const bytes = JSON.stringify({ schema_version: 1, name: 'Fixture List', plugins: [], collections: 7 })
    expect((await failureFrom(bytes)).message).toMatch(/collections in a shape that cannot be read/)
  })

  it('tells it as coming from the publisher, not from this machine being offline', async () => {
    expect((await failureFrom('{"plugins":"everything"}')).reason).toBe('empty')
  })
})
