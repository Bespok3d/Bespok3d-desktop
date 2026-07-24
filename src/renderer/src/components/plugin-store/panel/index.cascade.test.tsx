// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin, makeIndexEntry } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

function renderInstalled(uninstall: ReturnType<typeof vi.fn>, installedIds: string[]) {
  return setup(
    <PluginPanel
      plugin={makePlugin({ id: 'rfid-ntag', name: 'rfid-ntag', title: 'RFID NTAG' })}
      installed={true}
      hasUpdate={false}
      printerId="printer-1"
      installedVersion="1.0.0"
      allInstalledIds={installedIds}
      onClose={vi.fn()}
      onOperationDone={vi.fn()}
    />,
    {
      withCatalog: true,
      catalog: [makeIndexEntry({ name: 'rfid-ntag' }), makeIndexEntry({ name: 'spoolman', deps: ['rfid-ntag'] })],
      b3d: { store: { uninstall } },
    },
  )
}

describe('PluginPanel uninstall + cascade wiring', () => {
  it('uninstalls directly when nothing depends on the plugin', async () => {
    var uninstall = vi.fn().mockResolvedValue([])
    var { user } = renderInstalled(uninstall, ['rfid-ntag'])
    await user.click(screen.getByRole('button', { name: en('btn.uninstall') }))
    expect(uninstall).toHaveBeenCalledWith('printer-1', 'rfid-ntag', undefined)
  })

  it('warns about dependents and cascades on confirm', async () => {
    var uninstall = vi.fn().mockResolvedValue([])
    var { user } = renderInstalled(uninstall, ['rfid-ntag', 'spoolman'])
    await user.click(screen.getByRole('button', { name: en('btn.uninstall') }))

    expect(await screen.findByText(en('store.cascade.title'))).toBeInTheDocument()
    expect(screen.getByText(en('store.cascade.summary', { plugin: 'RFID NTAG', deps: 'spoolman' }))).toBeInTheDocument()
    expect(uninstall).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: en('store.cascade.confirm') }))
    expect(uninstall).toHaveBeenCalledWith('printer-1', 'rfid-ntag', true)
  })

  it('keeps the plugin when the cascade dialog is cancelled', async () => {
    var uninstall = vi.fn().mockResolvedValue([])
    var { user } = renderInstalled(uninstall, ['rfid-ntag', 'spoolman'])
    await user.click(screen.getByRole('button', { name: en('btn.uninstall') }))
    await screen.findByText(en('store.cascade.title'))

    await user.click(screen.getByRole('button', { name: en('btn.cancel') }))
    expect(screen.queryByText(en('store.cascade.title'))).not.toBeInTheDocument()
    expect(uninstall).not.toHaveBeenCalled()
  })
})
