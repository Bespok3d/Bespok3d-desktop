// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// No list declares which repo published a plugin, so it is derived from the entry's own fields. These
// pin the derivation: the wrong owner/repo means asking a stranger's repo what this plugin released,
// and a bundled entry names no repo at all and must say so rather than guess one.
import { describe, it, expect } from 'vitest'
import type { IndexEntry } from '../model'
import { publishingRepoOf } from './publishing-repo'

const ASSET_URL = 'https://api.github.com/repos/fixture-owner/rfid-tools/releases/assets/4242'
const BLOB_URL = 'https://github.com/fixture-owner/rfid-tools/blob/main/doc/README.md'

function listedEntry(fields: Record<string, unknown>): IndexEntry {
  return { name: 'rfid-tools', version: '0.1.9', ...fields }
}

describe('publishingRepoOf', () => {
  it('reads the repo out of the release asset url an install actually fetches', () => {
    expect(publishingRepoOf(listedEntry({ download_url: ASSET_URL }))).toEqual({ owner: 'fixture-owner', repo: 'rfid-tools' })
  })

  it('falls back to the doc url when the payload is hosted elsewhere', () => {
    expect(publishingRepoOf(listedEntry({ download_url: 'https://files.example.invalid/rfid-tools-0.1.9.b3', doc_url: BLOB_URL }))).toEqual({
      owner: 'fixture-owner',
      repo: 'rfid-tools',
    })
  })

  it('prefers the download url over the doc url, so the refresh asks the repo the package comes from', () => {
    const split = listedEntry({ download_url: ASSET_URL, doc_url: 'https://github.com/other-owner/other-repo/blob/main/README.md' })

    expect(publishingRepoOf(split)?.repo).toBe('rfid-tools')
  })

  it('names no repo for a bundled entry whose download url is a path beside its list', () => {
    expect(publishingRepoOf(listedEntry({ download_url: 'packages/rfid-tools-0.1.9.b3' }))).toBeNull()
  })

  it('names no repo when the entry carries neither field', () => {
    expect(publishingRepoOf(listedEntry({}))).toBeNull()
  })

  it('names no repo for a host that merely looks like github', () => {
    expect(publishingRepoOf(listedEntry({ download_url: 'https://api.github.com.example.invalid/repos/thief/repo/releases/assets/1' }))).toBeNull()
  })
})
