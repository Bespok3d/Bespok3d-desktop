// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { digest, sequential } from './release-io.mjs'

export async function servedCatalog(url, publicKey, services, visited = new Set()) {
  if (visited.has(url)) throw new Error(`duplicate or cyclic index: ${url}`)
  visited.add(url)
  const bytes = await services.http.bytes(url)
  const signature = await services.http.bytes(`${url}.sig`, true)
  if (!signature || !await services.tooling.verifyDetached(bytes, signature.toString('utf8'), publicKey)) throw new Error(`index signature invalid or missing: ${url}`)
  const index = JSON.parse(bytes.toString('utf8'))
  const children = await sequential(index.lists ?? [], function (list) {
    return servedCatalog(list.url, publicKey, services, visited)
  })
  const indexes = [{ url, sha256: digest(bytes), signatureSha256: digest(signature), signature: 'verified' }, ...children.flatMap(function (child) { return child.indexes })]
  const units = [...index.plugins ?? [], ...children.flatMap(function (child) { return child.units })]
  return { indexes, units }
}

export function candidateMembership(catalog) {
  return catalog.units.map(function (unit) {
    return { name: unit.name, version: unit.version, download_url: unit.download_url ?? null }
  }).sort(function (earlier, later) { return earlier.name.localeCompare(later.name) })
}
