// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The dev menu-bar rail: macOS reads the application-menu title off the running bundle's
// CFBundleName, so a dev run says "Electron" unless name-dev-electron-bundle.sh has renamed
// node_modules' stock bundle to the product name plus the dev marker. This proves the script does
// that, is idempotent, leaves the ad-hoc signature valid (an unsigned edit stops the bundle
// launching), and is still wired into `npm run dev`.
//
// Stands down where there is nothing to name: non-macOS, or a checkout with no electron installed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEV_BUNDLE = join(REPO_ROOT, 'node_modules', 'electron', 'dist', 'Electron.app')
const PLIST = join(DEV_BUNDLE, 'Contents', 'Info.plist')
const NAMING_SCRIPT = join(REPO_ROOT, 'scripts', 'name-dev-electron-bundle.sh')

const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
const expectedBundleName = `${packageJson.build.productName} Dev`
const noDevBundle = process.platform !== 'darwin' || !existsSync(PLIST)

function bundleNameKey(key) {
  return execFileSync('plutil', ['-extract', key, 'raw', PLIST], { encoding: 'utf8' }).trim()
}

function runNamingScript() {
  return execFileSync('sh', [NAMING_SCRIPT], { encoding: 'utf8' })
}

test('the dev bundle carries the app name macOS puts in the menu bar', { skip: noDevBundle }, () => {
  runNamingScript()

  assert.equal(bundleNameKey('CFBundleName'), expectedBundleName)
  assert.equal(bundleNameKey('CFBundleDisplayName'), expectedBundleName)
})

test('running it again changes nothing and re-signing kept the bundle launchable', { skip: noDevBundle }, () => {
  runNamingScript()

  assert.equal(bundleNameKey('CFBundleName'), expectedBundleName)
  execFileSync('codesign', ['--verify', DEV_BUNDLE])
})

test('`npm run dev` runs the naming script', () => {
  assert.match(packageJson.scripts.predev, /name-dev-electron-bundle\.sh/)
})

// The menu-bar title and the name the app calls itself are set in two different languages, and they
// have to agree: they decide the profile directory and the keychain item together. This fails if
// either side is renamed alone.
test('the name in the menu bar is the name the dev run calls itself', () => {
  const mainProcessSource = readFileSync(join(REPO_ROOT, 'src', 'main', 'index.ts'), 'utf8')

  assert.match(mainProcessSource, new RegExp(`is\\.dev \\? '${expectedBundleName}' :`))
})
