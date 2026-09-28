// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from 'node:child_process'
import { openSync, closeSync } from 'node:fs'
import { command } from './release-io.mjs'

export function githubClient() {
  function json(endpoint) {
    return JSON.parse(command('gh', ['api', endpoint]))
  }
  function optional(endpoint) {
    try { return json(endpoint) } catch (error) {
      if (String(error.stderr).includes('(HTTP 404)')) return null
      throw error
    }
  }
  function download(endpoint, path) {
    const descriptor = openSync(path, 'w')
    try { execFileSync('gh', ['api', endpoint], { stdio: ['ignore', descriptor, 'pipe'] }) } finally { closeSync(descriptor) }
  }
  function tag(repository, name) {
    const ref = optional(`repos/${repository}/git/ref/tags/${encodeURIComponent(name)}`)
    if (!ref) return null
    if (ref.object.type === 'commit') return { commit: ref.object.sha, message: null }
    const annotated = json(`repos/${repository}/git/tags/${ref.object.sha}`)
    if (annotated.object.type !== 'commit') throw new Error(`${name}: nested/non-commit tag`)
    return { commit: annotated.object.sha, message: annotated.message }
  }
  function permissions(repository) {
    const metadata = json(`repos/${repository}`)
    if (!metadata.permissions?.push || metadata.archived || metadata.disabled || metadata.private) throw new Error(`public release permission unavailable: ${repository}`)
    const workflows = json(`repos/${repository}/actions/permissions`)
    if (!workflows.enabled) throw new Error(`Actions disabled: ${repository}`)
    const rules = json(`repos/${repository}/rulesets?includes_parents=true`)
    if (rules.some(function (rule) { return rule.target === 'tag' && rule.enforcement === 'active' })) throw new Error(`active tag rules need a proved release permission: ${repository}`)
    return { repository, accountPushAccess: true, actionsEnabled: true, tagRules: 'none active' }
  }
  return { json, optional, download, tag, permissions }
}

export async function waitUntil(inspect, label, { attempts = 180, delay = 10000 } = {}) {
  var remaining = attempts
  for await (const unused of Array.from({ length: attempts })) {
    void unused
    const result = await inspect()
    if (result) return result
    remaining -= 1
    if (remaining) await new Promise(function (resolve) { setTimeout(resolve, delay) })
  }
  throw new Error(`timed out waiting for ${label}`)
}
