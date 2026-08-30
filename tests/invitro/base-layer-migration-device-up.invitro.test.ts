// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchCapabilities } from '../../src/main/daemon-client/client'
import { installBatchPackages, type BatchUpdatePackage } from '../../src/main/daemon-client/packages-client'
import { makeDeviceTarget } from './device-target'

// Brings the Docker device to the state a user's printer is in BEFORE the base-layer migration:
// stock Klipper source on disk, the printer's own patch program (BusyBox, not the Mac's GNU patch),
// and the three old patching feature plugins installed. Writes the managed record that the
// base-layer-migration test files drive, and leaves the container running for them.
// Inert unless B3D_MIGRATION_DEVICE_UP is set.
const deviceUp = process.env.B3D_MIGRATION_DEVICE_UP
const oldPackageDir = process.env.B3D_MIGRATION_OLD_PACKAGES ?? ''
const busyboxBinary = process.env.B3D_MIGRATION_BUSYBOX ?? ''
const recordPath = process.env.B3D_MIGRATION_RECORD ?? ''
const stockFirmware = process.env.B3D_MIGRATION_FW ?? '1.4.1.6'
const firmwareAfterOta = process.env.B3D_MIGRATION_OTA_TO ?? ''
const SSH_PORT = 2222
const DEVICE_KLIPPER_HOME = '/home/lava/klipper'

const OLD_PATCHING_PLUGINS = [
  'klipper-motion-0.1.3.b3',
  'print-prefs-core-0.1.1.b3',
  'rfid-ntag-0.1.12.b3',
]

function pluginIdOf(fileName: string): string {
  return fileName.replace(/-\d+\.\d+\.\d+\.b3$/, '')
}

function packageOf(fileName: string): BatchUpdatePackage {
  return { pluginId: pluginIdOf(fileName), bytes: readFileSync(`${oldPackageDir}/${fileName}`) }
}

function deviceContainer(): string {
  return execFileSync('docker', ['ps', '--filter', `publish=${SSH_PORT}`, '--format', '{{.ID}}'], { encoding: 'utf8' }).trim()
}

function inDevice(container: string, script: string): void {
  execFileSync('docker', ['exec', container, 'sh', '-c', script])
}

// The daemon shells out to `patch`; the printer's is BusyBox. BusyBox dispatches on argv0, so a
// symlink named patch makes the container apply patches exactly the way the printer does.
function injectPrinterPatchTool(container: string): void {
  execFileSync('docker', ['cp', busyboxBinary, `${container}:/usr/local/bin/busybox`])
  inDevice(container, 'chmod 755 /usr/local/bin/busybox && ln -sf busybox /usr/local/bin/patch')
}

function corpusDir(firmware: string): string {
  return `../plugins/u1-base/tests_support/snapmaker_source/${firmware}`
}

// The stock source AND the firmware stamp the jinni reads, so the daemon picks the patch rules the
// printer on that firmware would. The stamp suffix is a made-up build date.
function seedStockKlipperSource(container: string, firmware: string): void {
  inDevice(container, `rm -rf ${DEVICE_KLIPPER_HOME}/klippy && printf "%s_20000101000000\\n" "${firmware}" > /etc/FULLVERSION`)
  execFileSync('docker', ['cp', `${corpusDir(firmware)}/klippy`, `${container}:${DEVICE_KLIPPER_HOME}/`])
}

// A Snapmaker firmware update replaces the Klipper source under the installed plugins: their patched
// files are gone, their registry entries stay. That is the state a printer updated after installing
// the old plugins is in when the store migration reaches it.
function applyFirmwareUpdate(container: string, firmware: string): void {
  seedStockKlipperSource(container, firmware)
}

// The plugins ask for a klipper restart on install; the jinni runs the stock init scripts.
function seedServiceScripts(container: string): void {
  inDevice(container, 'printf "#!/bin/sh\\nexit 0\\n" > /etc/init.d/S60klipper && cp /etc/init.d/S60klipper /etc/init.d/S61moonraker && chmod 755 /etc/init.d/S60klipper /etc/init.d/S61moonraker')
}

// After the restart batch the daemon asks the jinni whether klipper and moonraker came back; with
// no klippy socket the jinni probes moonraker's HTTP port, and any response there counts as up.
// A BusyBox httpd answering on 7125 stands in for both services, so the health verdict matches a
// printer whose Klipper came back ready.
function seedServiceHealthStub(container: string): void {
  const klippyReadyBody = '{\\"result\\":{\\"klippy_state\\":\\"ready\\",\\"klippy_connected\\":true,\\"failed_components\\":[],\\"warnings\\":[]}}'
  inDevice(container, `mkdir -p /srv/b3dstub/printer /srv/b3dstub/server && printf "%s" "${klippyReadyBody}" > /srv/b3dstub/printer/info && cp /srv/b3dstub/printer/info /srv/b3dstub/server/info && /usr/local/bin/busybox httpd -p 127.0.0.1:7125 -h /srv/b3dstub`)
}

describe.skipIf(!deviceUp)('device up: a printer running the old patching plugins', () => {

  it('provisions the device and installs the old feature plugins', async () => {
    expect(oldPackageDir).not.toBe('')
    expect(busyboxBinary).not.toBe('')
    expect(recordPath).not.toBe('')
    const target = makeDeviceTarget(SSH_PORT)
    await target.prepare()
    const container = deviceContainer()
    expect(container).not.toBe('')
    injectPrinterPatchTool(container)
    seedStockKlipperSource(container, stockFirmware)
    seedServiceScripts(container)
    seedServiceHealthStub(container)
    const record = target.daemonRecord()
    const result = await installBatchPackages(record, OLD_PATCHING_PLUGINS.map(packageOf))
    console.log('old plugin install:', JSON.stringify(result))
    expect(result.ok).toBe(true)
    const caps = await fetchCapabilities(record)
    console.log('installed before migration:', JSON.stringify(caps.installed))
    expect(caps.installed['klipper-motion']).toBe('0.1.3')
    expect(caps.installed['print-prefs-core']).toBe('0.1.1')
    expect(caps.installed['rfid-ntag']).toBe('0.1.12')
    if (firmwareAfterOta) {
      applyFirmwareUpdate(container, firmwareAfterOta)
      console.log('firmware updated under the old plugins to', firmwareAfterOta)
    }
    writeFileSync(recordPath, JSON.stringify(record))
    writeFileSync(`${recordPath}.container`, container)
  }, 900000)
})
