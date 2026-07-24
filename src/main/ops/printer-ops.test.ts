import { describe, it, expect, vi } from 'vitest'

// printer-ops imports the U1 adapter client (electron-bound) at module load; stub the heavy edges so the
// pure command builder can be imported in isolation.
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() } }))
vi.mock('@adapters/snapmaker-u1/client/snapmaker-u1', () => ({ patchS90lmd: (text: string) => text }))

import { bespok3dRemovalCommand } from './printer-ops'

describe('bespok3dRemovalCommand', () => {
  const command = bespok3dRemovalCommand()

  it('recreates the dhcpcd state dir after removing its dangling symlink (or no DHCP on reboot)', () => {
    expect(command).toContain('rm -f /var/db/dhcpcd ; mkdir -p /var/db/dhcpcd')
  })

  it('re-locks the overlay by removing /oem/.debug for a truly-mint state on the next boot', () => {
    expect(command).toContain('rm -f /oem/.debug')
  })

  it('still removes the workspace and the boot hook', () => {
    expect(command).toContain('rm -rf /userdata/bespok3d')
    expect(command).toContain("sed -i '/S99bespok3d/d' /etc/init.d/S90lmd")
  })
})
