// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, act } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

function renderPanel(plugin = makePlugin({ id: 'oe', log: {} }), initialTab?: string) {
  return setup(
    <PluginPanel
      plugin={plugin}
      installed
      hasUpdate={false}
      printerId="printer-1"
      installedVersion="1.0.0"
      allInstalledIds={[plugin.id]}
      onClose={vi.fn()}
      onOperationDone={vi.fn()}
      initialTab={initialTab}
    />,
    { withCatalog: true, catalog: [] },
  )
}

describe('PluginPanel captured tab', () => {
  it('shows the Captured tab for an installed plugin that declares a log', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: en('store.tab_captured') })).toBeInTheDocument()
  })

  it('hides the Captured tab when the plugin declares no log', () => {
    renderPanel(makePlugin({ id: 'plain' }))
    expect(screen.queryByRole('button', { name: en('store.tab_captured') })).not.toBeInTheDocument()
  })

  it('opens directly on the Captured output tab when initialTab requests it', () => {
    renderPanel(makePlugin({ id: 'oe', log: {} }), 'captured')
    expect(screen.getByText(en('store.captured_empty'))).toBeInTheDocument()
  })

  it('renders a live-captured URL with copy and open-in-browser actions', async () => {
    const { user, emit, b3d } = renderPanel()
    await user.click(screen.getByRole('button', { name: en('store.tab_captured') }))
    act(() =>
      emit.pluginLog({
        printerId: 'printer-1',
        pluginId: 'oe',
        value: 'https://octoeverywhere.com/getstarted?code=XYZ',
        pattern: 'url',
        captures: ['https://octoeverywhere.com/getstarted?code=XYZ'],
      }),
    )
    expect(screen.getByText('https://octoeverywhere.com/getstarted?code=XYZ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('store.captured_open') }))
    expect(b3d.openUrl).toHaveBeenCalledWith('https://octoeverywhere.com/getstarted?code=XYZ')
  })
})
