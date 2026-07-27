// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { makeIndexEntry, makePrinter, makeCapabilities } from '../../test/fixtures'
import { PluginStore } from '.'

const en = makeT('en')

function managedTree(installingSelected: boolean) {
  return <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} installingSelected={installingSelected} />
}

describe('PluginStore update-all wiring', () => {
  it('offers Update all for an out-of-date plugin and dispatches the batch specs', async () => {
    var onUpdateAll = vi.fn()
    var { user } = setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onUpdateAll={onUpdateAll} />,
      {
        withCatalog: true,
        catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
        b3d: { store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({ 'demo-a': '0.9.0' })) } },
      },
    )

    var button = await screen.findByRole('button', { name: en('store.update_all', { count: 1 }) })
    await user.click(button)

    expect(onUpdateAll).toHaveBeenCalledWith('printer-1', expect.arrayContaining([expect.objectContaining({ pluginId: 'demo-a' })]))
  })

  // Updating everything at once is an automation of updating them one at a time, so it answers to the
  // same gate: while the printer is printing there is no update-all, exactly as there is no install.
  it('locks Update all while a print is running', async () => {
    var onUpdateAll = vi.fn()
    var { user, emit } = setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onUpdateAll={onUpdateAll} />,
      {
        withCatalog: true,
        catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
        b3d: { store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({ 'demo-a': '0.9.0' })) } },
      },
    )
    var button = await screen.findByRole('button', { name: en('store.update_all', { count: 1 }) })
    act(() => emit.printState({ printerId: 'printer-1', blockedActions: ['install'], at: Date.now() }))

    expect(button).toBeDisabled()
    await user.click(button)
    expect(onUpdateAll).not.toHaveBeenCalled()
  })

  it('shows no Update all button when everything is current', async () => {
    setup(
      <PluginStore printer={makePrinter({ status: 'managed' })} grouped={false} onUpdateAll={vi.fn()} />,
      {
        withCatalog: true,
        catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha', version: '1.0.0' })],
        b3d: { store: { capabilities: vi.fn().mockResolvedValue(makeCapabilities({ 'demo-a': '1.0.0' })) } },
      },
    )
    await screen.findByText('Alpha')
    expect(screen.queryByRole('button', { name: en('store.update_all', { count: 1 }) })).not.toBeInTheDocument()
  })

  it('re-fetches the installed set when a batch settles, so the grid is not stale until a manual reload', async () => {
    var capabilities = vi.fn().mockResolvedValue(makeCapabilities({}))
    var { rerender } = setup(managedTree(false), {
      withCatalog: true,
      catalog: [makeIndexEntry({ name: 'demo-a', title: 'Alpha' })],
      b3d: { store: { capabilities } },
    })
    await screen.findByText('Alpha')
    await waitFor(() => expect(capabilities).toHaveBeenCalledTimes(1))

    rerender(managedTree(true))
    rerender(managedTree(false))

    await waitFor(() => expect(capabilities).toHaveBeenCalledTimes(2))
  })
})
