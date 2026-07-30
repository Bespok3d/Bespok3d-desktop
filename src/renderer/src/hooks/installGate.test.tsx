// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { setup } from '../test/harness'
import { InstallGateModals } from '../components/install-gate'
import { InstallGateContext, MOVED_VERSIONS_SUPPRESS_KEY, useInstallGate } from './installGate'
import type { GatedInstall } from './installGate'
import { usePluginOps } from './pluginOps'
import { useBatchOps } from '../components/batch-ops'

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

// An install asking to start, wired the way the app wires it: the gate is made once and the dialogs it
// puts up are mounted beside the thing that asked.
function InstallHarness({ onInstall }: { onInstall: () => void }) {
  const gate = useInstallGate()

  return (
    <>
      <button type="button" onClick={() => gate.beforeInstall(onInstall)}>install</button>
      <InstallGateModals gate={gate} />
    </>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('what an install is asked before it starts', () => {
  it('starts straight away when the listing was refreshed within the hour', async () => {
    const install = vi.fn()
    const harness = setup(<InstallHarness onInstall={install} />, { withCatalog: true })
    await harness.user.click(screen.getByText('install'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
    expect(screen.queryByText(/proceed with the proposed list/i)).not.toBeInTheDocument()
  })

  it('states how old the listing is when it is older than an hour', async () => {
    const harness = setup(<InstallHarness onInstall={vi.fn()} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: Date.now() - THREE_HOURS_MS }) } },
    })
    await harness.user.click(screen.getByText('install'))
    await waitFor(() => expect(screen.getByText(/it has been 03:00 since the last listing refresh/i)).toBeInTheDocument())
  })

  it('says the listing has never been refreshed when it has not', async () => {
    const harness = setup(<InstallHarness onInstall={vi.fn()} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }) } },
    })
    await harness.user.click(screen.getByText('install'))
    await waitFor(() => expect(screen.getByText(/has not been refreshed yet/i)).toBeInTheDocument())
  })
})

describe('what the answer to the offer does to the install', () => {
  it('installs the proposed list, without refreshing, when that is the answer', async () => {
    const install = vi.fn()
    const refreshListing = vi.fn().mockResolvedValue({ askedRepos: 0, moved: [] })
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }), refreshListing } },
    })
    await harness.user.click(screen.getByText('install'))
    await harness.user.click(await screen.findByText('Proceed with the proposed list'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
    expect(refreshListing).not.toHaveBeenCalled()
  })

  it('refreshes, then installs without a second question when nothing moved', async () => {
    const install = vi.fn()
    const refreshListing = vi.fn().mockResolvedValue({ askedRepos: 3, moved: [] })
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }), refreshListing } },
    })
    await harness.user.click(screen.getByText('install'))
    await harness.user.click(await screen.findByText('Update the list now'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
    expect(refreshListing).toHaveBeenCalledOnce()
  })

  it('shows what moved before it installs, and installs once that is read', async () => {
    const install = vi.fn()
    const moved = [{ pluginName: 'spoolman', listedVersion: '0.1.28', freshVersion: '0.1.29' }]
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: {
        registry: {
          refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }),
          refreshListing: vi.fn().mockResolvedValue({ askedRepos: 3, moved }),
        },
      },
    })
    await harness.user.click(screen.getByText('install'))
    await harness.user.click(await screen.findByText('Update the list now'))
    expect(await screen.findByText('spoolman: 0.1.28 becomes 0.1.29')).toBeInTheDocument()
    expect(install).not.toHaveBeenCalled()
    await harness.user.click(screen.getByText('Install'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
  })

  it('skips the what-moved list for someone who asked not to see it again', async () => {
    window.localStorage.setItem(MOVED_VERSIONS_SUPPRESS_KEY, 'true')
    const install = vi.fn()
    const moved = [{ pluginName: 'spoolman', listedVersion: '0.1.28', freshVersion: '0.1.29' }]
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: {
        registry: {
          refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }),
          refreshListing: vi.fn().mockResolvedValue({ askedRepos: 3, moved }),
        },
      },
    })
    await harness.user.click(screen.getByText('install'))
    await harness.user.click(await screen.findByText('Update the list now'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
  })
})

describe('an install the listing cannot be checked for', () => {
  it('installs anyway when the offer itself cannot be answered', async () => {
    const install = vi.fn()
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockRejectedValue(new Error('main is not answering')) } },
    })
    await harness.user.click(screen.getByText('install'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
  })

  it('installs anyway when the refresh fails', async () => {
    const install = vi.fn()
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: {
        registry: {
          refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }),
          refreshListing: vi.fn().mockRejectedValue(new Error('github said no')),
        },
      },
    })
    await harness.user.click(screen.getByText('install'))
    await harness.user.click(await screen.findByText('Update the list now'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
  })

  it('installs nothing when the question is dismissed', async () => {
    const install = vi.fn()
    const harness = setup(<InstallHarness onInstall={install} />, {
      withCatalog: true,
      b3d: { registry: { refreshOffer: vi.fn().mockResolvedValue({ offered: true, refreshedAt: null }) } },
    })
    await harness.user.click(screen.getByText('install'))
    await screen.findByText('Proceed with the proposed list')
    await harness.user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('Proceed with the proposed list')).not.toBeInTheDocument())
    expect(install).not.toHaveBeenCalled()
  })
})

// One plugin, an update and a multi select are three different call paths, and every one of them has to
// reach the printer through the same gate. These hold the wiring: a gate that never answers must leave
// each of them not installed.
function SinglePluginHarness() {
  const ops = usePluginOps(() => undefined)

  return <button type="button" onClick={() => ops.install('printer-1', 'spoolman')}>single</button>
}

function BatchHarness({ gate }: { gate: GatedInstall }) {
  const batchOps = useBatchOps([], () => undefined, gate)

  return (
    <>
      <button type="button" onClick={() => batchOps.runUpdateAll('printer-1', [{ pluginId: 'spoolman' }])}>update all</button>
      <button type="button" onClick={() => batchOps.runInstallBatch('printer-1', [{ pluginId: 'spoolman' }])}>install selected</button>
    </>
  )
}

describe('every way an install can start goes through the gate', () => {
  it('holds a single-plugin install until the gate lets it through', async () => {
    const gate = vi.fn()
    const harness = setup(
      <InstallGateContext.Provider value={gate}><SinglePluginHarness /></InstallGateContext.Provider>,
    )
    await harness.user.click(screen.getByText('single'))
    expect(gate).toHaveBeenCalledOnce()
    expect(harness.b3d.store.install).not.toHaveBeenCalled()
    gate.mock.calls[0][0]()
    await waitFor(() => expect(harness.b3d.store.install).toHaveBeenCalledOnce())
  })

  it('holds an update-all until the gate lets it through', async () => {
    const gate = vi.fn()
    const harness = setup(<BatchHarness gate={gate} />)
    await harness.user.click(screen.getByText('update all'))
    expect(gate).toHaveBeenCalledOnce()
    expect(harness.b3d.store.updateBatch).not.toHaveBeenCalled()
    gate.mock.calls[0][0]()
    await waitFor(() => expect(harness.b3d.store.updateBatch).toHaveBeenCalledOnce())
  })

  it('holds a multi-select install until the gate lets it through', async () => {
    const gate = vi.fn()
    const harness = setup(<BatchHarness gate={gate} />)
    await harness.user.click(screen.getByText('install selected'))
    expect(gate).toHaveBeenCalledOnce()
    expect(harness.b3d.store.installBatch).not.toHaveBeenCalled()
    gate.mock.calls[0][0]()
    await waitFor(() => expect(harness.b3d.store.installBatch).toHaveBeenCalledOnce())
  })
})
