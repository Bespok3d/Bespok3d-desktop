// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, afterEach } from 'vitest'
import { httpGet, fetchSignatureAt } from './request'

function droppedConnection(): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_SOCKET' } })
}

function timedOut(): Error {
  return Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
}

function answered(): Response {
  return new Response('{}', { status: 200 })
}

afterEach(function restoreFetch() {
  vi.unstubAllGlobals()
})

describe('httpGet when the host drops the connection', () => {
  it('keeps asking through four drops and returns the answer', async () => {
    var fetchMock = vi.fn()
      .mockRejectedValueOnce(droppedConnection())
      .mockRejectedValueOnce(droppedConnection())
      .mockRejectedValueOnce(droppedConnection())
      .mockRejectedValueOnce(droppedConnection())
      .mockResolvedValueOnce(answered())
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpGet('https://example.invalid/index.json', {})).resolves.toMatchObject({ status: 200 })
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('gives up after five drops rather than asking forever', async () => {
    var fetchMock = vi.fn().mockRejectedValue(droppedConnection())
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpGet('https://example.invalid/index.json', {})).rejects.toThrow('fetch failed')
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })
})

describe('the signature that rides beside a list', () => {
  it('asks again after a dropped connection, so a signed list is not read as unsigned', async () => {
    var fetchMock = vi.fn().mockRejectedValueOnce(droppedConnection()).mockResolvedValueOnce(new Response('a signature', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchSignatureAt('https://example.invalid/index.json.sig')).resolves.toBe('a signature')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('httpGet when the host is unreachable or slow', () => {
  it('does not ask a timed-out host again', async () => {
    var fetchMock = vi.fn().mockRejectedValue(timedOut())
    vi.stubGlobal('fetch', fetchMock)

    await expect(httpGet('https://example.invalid/index.json', {})).rejects.toThrow('timeout')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
