// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// The daemon and the jinni have a store card like anything else in the catalog. Removing either one
// strands an enrolled printer, so the card must never offer it, whatever the printer's plugin list
// says is installed.
import { describe, it, expect, vi } from 'vitest'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

// Every action the card's foot offers, so the assertion is "these and no others" rather than the
// absence of one button someone could reintroduce under a different label.
function footActions(): string[] {
  const foot = document.querySelector('.panel-foot')

  return [...(foot?.querySelectorAll('button') ?? [])].map((action) => action.textContent?.trim() ?? '')
}

function openDaemonCard(installed: boolean) {
  setup(
    <PluginPanel
      plugin={makePlugin({ id: 'bespok3d-daemon', name: 'bespok3d-daemon', systemPackage: true })}
      installed={installed} hasUpdate printerId="printer-1" installedVersion="0.12.22"
      allInstalledIds={installed ? ['bespok3d-daemon'] : []} onClose={vi.fn()} onOperationDone={vi.fn()}
    />,
    { withCatalog: true, catalog: [] },
  )
}

describe('the daemon card never offers to remove the daemon', () => {
  it('offers no uninstall when the printer reports the daemon installed', () => {
    openDaemonCard(true)
    expect(footActions()).not.toContain(en('btn.uninstall'))
    expect(footActions()).toHaveLength(2)
  })

  // Whether it is on the printer is decided in one place and read by the grid card and this panel
  // alike. Second-guessing it here is what had the grid saying Install and the panel Reinstall for
  // the same daemon in the same breath.
  it('says the same thing the grid card says when it is not on the printer', () => {
    openDaemonCard(false)
    expect(footActions()).not.toContain(en('btn.uninstall'))
    expect(footActions()).toContain(en('btn.install'))
  })

  it('still offers uninstall for an ordinary installed plugin', () => {
    setup(
      <PluginPanel plugin={makePlugin({ id: 'spoolman' })} installed hasUpdate={false} printerId="printer-1" installedVersion="1.0.0" allInstalledIds={['spoolman']} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [] },
    )
    expect(footActions()).toContain(en('btn.uninstall'))
  })
})
