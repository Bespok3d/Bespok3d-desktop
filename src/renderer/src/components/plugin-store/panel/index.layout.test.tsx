// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { setup } from '../../../test/harness'
import { makePlugin, makeIndexEntry } from '../../../test/fixtures'
import { PluginPanel } from '.'

function renderPanel() {
  return setup(
    <PluginPanel
      plugin={makePlugin({ id: 'demo', doc: '# Doc\n\nlong content' })}
      installed hasUpdate={false} printerId="printer-1" installedVersion="1.0.0"
      allInstalledIds={['demo']} onClose={vi.fn()} onOperationDone={vi.fn()}
    />,
    { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
  )
}

describe('PluginPanel modal layout', () => {
  it('puts tab content in a single scroll region so a long tab cannot grow the modal past the window', () => {
    renderPanel()
    const scroll = document.querySelector('.plugin-modal .panel-scroll')
    expect(scroll).toBeTruthy()
    // The footer is a sibling of the scroll region, not inside it, so it stays pinned while content scrolls.
    const foot = document.querySelector('.plugin-modal .panel-foot')
    expect(foot).toBeTruthy()
    expect(scroll?.contains(foot)).toBe(false)
  })

  it('keeps the close button as a direct child of the modal (anchored top-right, not in the scroll)', () => {
    renderPanel()
    const close = document.querySelector('.plugin-modal > .panel-close')
    expect(close).toBeTruthy()
  })
})
