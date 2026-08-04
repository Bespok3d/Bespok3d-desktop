// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The Linux artifacts are built by electron-builder from package.json, so the facts a Linux user
// depends on are config, not code, and nothing else in the suite would notice them going missing.

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGE_JSON = join(APP_DIR, 'package.json')
const RELEASE_SCRIPT = join(APP_DIR, 'scripts/release.sh')
const FLATPAK_SCRIPT = join(APP_DIR, 'scripts/flatpak-build.sh')

interface LinuxTarget {
  target: string
  arch?: string[]
}

interface BuildConfig {
  linux: { target: LinuxTarget[] }
  flatpak: { runtimeVersion: string; baseVersion: string; finishArgs: string[] }
}

function buildConfig(): BuildConfig {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).build
}

function packageScripts(): Record<string, string> {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')).scripts
}

describe('the Linux packaging targets', () => {
  it('keeps the AppImage out of the flatpak-only script, so a macOS cut still builds Linux', () => {
    const linuxTargets = buildConfig().linux.target.map((target) => target.target)

    expect(linuxTargets).toEqual(['AppImage'])
    expect(packageScripts()['package:flatpak']).toContain('--linux flatpak')
  })

  it('gives the Flatpak sandbox the network, the home directory and the secret store', () => {
    const { finishArgs } = buildConfig().flatpak

    // Network: mDNS discovery and the SSH enrollment. Home: sideloaded .b3 packages and the key
    // files. Secrets: safeStorage talks to libsecret over DBus, and without the name it silently
    // falls back to writing the git-host token in the clear.
    expect(finishArgs).toContain('--share=network')
    expect(finishArgs).toContain('--filesystem=home')
    expect(finishArgs).toContain('--talk-name=org.freedesktop.secrets')
  })

  it('pins the runtime and the Electron base app to the same branch', () => {
    const { runtimeVersion, baseVersion } = buildConfig().flatpak

    expect(runtimeVersion).toBe(baseVersion)
  })
})

describe('cutting a release from a machine that is not Linux', () => {
  it('never skips the Flatpak for want of a Linux host', () => {
    const releaseScript = readFileSync(RELEASE_SCRIPT, 'utf8')

    // Every cut so far was made on macOS, where the old host test silently dropped the Flatpak and
    // shipped a release the download page still described as having one.
    expect(releaseScript).not.toMatch(/uname -s.*=.*Linux/)
    expect(releaseScript).toContain('scripts/flatpak-build.sh')
  })

  it('runs flatpak-builder in a Linux container on the machine doing the cut', () => {
    const flatpakScript = readFileSync(FLATPAK_SCRIPT, 'utf8')

    expect(flatpakScript).toContain('docker run')
    expect(flatpakScript).toContain('--linux flatpak --publish never')
  })

  it('packs the build the host already made, so the signing key stays on the host', () => {
    const flatpakScript = readFileSync(FLATPAK_SCRIPT, 'utf8')

    // The plugin payload is signed by REGISTRY_SIGNING_KEY during the host's own build. The container
    // is handed the result; it must never run the packing step itself, which would need the key.
    expect(flatpakScript).not.toContain('pack-plugins')
    expect(flatpakScript).not.toContain('REGISTRY_SIGNING_KEY')
    expect(flatpakScript).toContain('out/main/index.js')
  })
})
