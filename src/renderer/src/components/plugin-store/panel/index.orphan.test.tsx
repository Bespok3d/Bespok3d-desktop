// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

describe('PluginPanel orphan (no catalog source)', () => {
  it('offers uninstall-only for an installed plugin with no source', () => {
    setup(
      <PluginPanel plugin={makePlugin({ id: 'demo', sources: [] })} installed hasUpdate={false} printerId="printer-1" installedVersion="1.0.0" allInstalledIds={['demo']} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [] },
    )
    expect(screen.getByText(en('store.orphan.title'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: en('btn.uninstall') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('btn.install') })).not.toBeInTheDocument()
  })
})
