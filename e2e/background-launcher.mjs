#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { installBackgroundWindowHook } from './background-inspector.mjs'

const binary = process.env.B3D_E2E_BINARY
if (!binary) throw new Error('B3D_E2E_BINARY is required by the background test launcher')
const args = process.argv.slice(2).filter((argument) => !argument.startsWith('--inspect'))
const source = readFileSync(new URL('./background-window.cjs', import.meta.url), 'utf8')
const child = spawn(binary, ['--inspect-brk=127.0.0.1:0', ...args], {
  env: process.env, stdio: ['ignore', 'pipe', 'pipe'],
})
var bufferedError = ''
var installing = false
var installed = false
const startupTimeout = setTimeout(() => fail(new Error('Electron did not expose its startup debugger')), 20_000)

function fail(error) {
  clearTimeout(startupTimeout)
  process.stderr.write(`Background test launch failed: ${error.message}\n`)
  child.kill('SIGKILL')
  process.exitCode = 1
}

async function instrument(endpoint) {
  installing = true
  await installBackgroundWindowHook(endpoint, source)
  installed = true
  clearTimeout(startupTimeout)
  process.stderr.write(bufferedError)
  bufferedError = ''
}

child.stdout.pipe(process.stdout)
child.stderr.on('data', function forwardAfterInjection(bytes) {
  if (installed) { process.stderr.write(bytes); return }
  bufferedError += String(bytes)
  const endpoint = bufferedError.match(/Debugger listening on (ws:\/\/\S+)/)?.[1]
  if (endpoint && !installing) instrument(endpoint).catch(fail)
})
child.on('error', fail)
child.on('exit', function finish(code) {
  clearTimeout(startupTimeout)
  process.exitCode = process.exitCode || code || (installed ? 0 : 1)
})
;['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(function forwardSignal(signal) {
  process.on(signal, () => child.kill(signal))
})
