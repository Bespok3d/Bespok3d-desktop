// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync } from 'node:fs'

export function digest(bytes, algorithm = 'sha256', encoding = 'hex') {
  return createHash(algorithm).update(bytes).digest(encoding)
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function writeJson(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(temporary, path)
}

export function command(program, args, options = {}) {
  const output = execFileSync(program, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
  return output === null ? '' : output.trim()
}

export function git(checkout, args) {
  return command('git', ['-C', checkout, ...args])
}

export async function sequential(items, action) {
  const results = []
  // Release order is observable. An async iterator avoids an unbounded recursive call stack.
  for await (const item of items) results.push(await action(item))
  return results
}

export function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} mismatch`)
}

export function requireText(value, label, pattern = /\S/) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`missing or invalid ${label}`)
  return value
}
