// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export function publicUrl(value, allowLoopback = false) {
  const url = new URL(value)
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)
  if (url.username || url.password || url.hostname === 'api.github.com') throw new Error(`non-anonymous release URL: ${url.origin}`)
  if (url.protocol !== 'https:' && !(allowLoopback && loopback && url.protocol === 'http:')) throw new Error(`HTTPS required: ${url.origin}`)
  return url
}

export function anonymousReader({ fetcher = fetch, allowLoopback = false } = {}) {
  async function response(value, optional = false, redirects = 0) {
    const url = publicUrl(value, allowLoopback)
    const served = await fetcher(url, { redirect: 'manual', credentials: 'omit', cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, signal: AbortSignal.timeout(180000) })
    if (served.status >= 300 && served.status < 400) {
      if (redirects >= 10 || !served.headers.get('location')) throw new Error(`invalid redirect: ${url}`)
      return response(new URL(served.headers.get('location'), url).href, optional, redirects + 1)
    }
    if (optional && served.status === 404) return null
    if (!served.ok) throw new Error(`HTTP ${served.status}: ${url}`)
    return served
  }
  async function bytes(url, optional = false) {
    const served = await response(url, optional)
    return served ? Buffer.from(await served.arrayBuffer()) : null
  }
  async function file(url, path) {
    const served = await response(url)
    await pipeline(Readable.fromWeb(served.body), createWriteStream(path))
    return path
  }
  return { bytes, file }
}
