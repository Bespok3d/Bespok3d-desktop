// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { makePlugin, makeSource, makeIndexEntry } from '../../../test/fixtures'
import { PluginPanel } from '.'

const en = makeT('en')

function twoSourcePlugin() {
  return makePlugin({
    id: 'demo',
    sources: [
      makeSource({ registryUrl: 'url-a', label: 'Source A', version: '1.0.0' }),
      makeSource({ registryUrl: 'url-b', label: 'Source B', version: '1.1.0' }),
    ],
  })
}

function twoChannelPlugin() {
  return makePlugin({
    id: 'demo',
    sources: [
      makeSource({ registryUrl: 'url-stable', label: 'Source A', version: '1.0.0', channel: 'stable' }),
      makeSource({ registryUrl: 'url-exp', label: 'Source B', version: '1.2.0', channel: 'experiment' }),
    ],
  })
}

function installedPanel(props: { installedVersion?: string; installedSource?: string; sourceVersion?: string; sourceUrl?: string }) {
  const plugin = makePlugin({
    id: 'demo', version: props.sourceVersion ?? '1.0.0',
    sources: [makeSource({ registryUrl: props.sourceUrl ?? 'url-a', label: 'Source A', version: props.sourceVersion ?? '1.0.0' })],
  })

  return setup(
    <PluginPanel plugin={plugin} installed={true} hasUpdate={false} printerId="printer-1"
      installedSource={props.installedSource} installedVersion={props.installedVersion} allInstalledIds={['demo']}
      onClose={vi.fn()} onOperationDone={vi.fn()} />,
    { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
  )
}

describe('PluginPanel version/source pick wiring', () => {
  it('nudges to Versions, then installs from the chosen source', async () => {
    var install = vi.fn().mockResolvedValue({ installedIds: ['demo'], log: { pluginId: 'demo', timestamp: 1, ok: true, phases: [] } })
    var { user } = setup(
      <PluginPanel plugin={twoSourcePlugin()} installed={false} hasUpdate={false} printerId="printer-1" allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })], b3d: { store: { install } } },
    )

    await user.click(screen.getByRole('button', { name: en('btn.install') }))
    expect(install).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Source B/ }))
    await user.click(screen.getByRole('button', { name: en('btn.install') }))

    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, [], 'url-b', 'stable')
  })

  it('picking a channel chip records the override and installs that channel variant', async () => {
    var install = vi.fn().mockResolvedValue({ installedIds: ['demo'], log: { pluginId: 'demo', timestamp: 1, ok: true, phases: [] } })
    var onChannelPref = vi.fn()
    var { user } = setup(
      <PluginPanel plugin={twoChannelPlugin()} installed={false} hasUpdate={false} printerId="printer-1"
        channelCeiling="stable" onChannelPref={onChannelPref} allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })], b3d: { store: { install } } },
    )

    await user.click(screen.getByRole('button', { name: en('btn.install') }))
    await user.click(screen.getByRole('button', { name: en('chan.experiment') }))

    expect(onChannelPref).toHaveBeenCalledWith('experiment')
    expect(screen.getByRole('button', { name: /Source B/ })).toHaveClass('selected')

    await user.click(screen.getByRole('button', { name: en('btn.install') }))
    expect(install).toHaveBeenCalledWith('printer-1', 'demo', undefined, [], 'url-exp', 'experiment')
  })

  it('ALL chip shows every source row; a channel chip filters the rows to that channel', async () => {
    var { user } = setup(
      <PluginPanel plugin={twoChannelPlugin()} installed={false} hasUpdate={false} printerId="printer-1"
        channelCeiling="stable" onChannelPref={vi.fn()} allInstalledIds={[]} onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    await user.click(screen.getByRole('button', { name: en('btn.install') }))

    expect(screen.getByRole('button', { name: /Source A/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Source B/ })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: en('chan.experiment') }))
    expect(screen.queryByRole('button', { name: /Source A/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Source B/ })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: en('filter.all') }))
    expect(screen.getByRole('button', { name: /Source A/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Source B/ })).toBeTruthy()
  })

  it('shows the on-printer version when the install is not from a listed source (same version)', async () => {
    // The reported case: installed v0.1.1 from an older source not in the catalog, while the catalog
    // lists the same plugin at the same version from a different source. The Versions tab must appear
    // and show what is on the printer, even though the version matches.
    var { user } = installedPanel({ installedVersion: '0.1.1', sourceVersion: '0.1.1', installedSource: undefined })
    await user.click(screen.getByRole('button', { name: en('store.tab_versions') }))
    const panel = document.querySelector('.panel-sources')
    expect(panel).toHaveTextContent(en('store.source_on_printer'))
    expect(panel).toHaveTextContent('0.1.1')
    expect(panel?.querySelector('.source-installed')).toBeTruthy()
  })

  it('hides the Versions tab for a clean install matching the single listed source and version', async () => {
    installedPanel({ installedVersion: '1.0.0', sourceVersion: '1.0.0', installedSource: 'url-a' })
    expect(screen.queryByRole('button', { name: en('store.tab_versions') })).toBeNull()
  })

  it('never pairs a channel label with another atom version (experiment row shows its own version)', async () => {
    // Device repro: only the experiment atom is in the catalog, sharing the bundled registryUrl with a
    // prior stable install the daemon reports as 0.1.2 on the stable channel. The experiment row must
    // show its OWN 0.2.0-experiment, never the leaked 0.1.2; the real install surfaces on the read-only
    // on-printer strip. Old code keyed "installed" on registryUrl alone and showed v0.1.2 on this row.
    const plugin = makePlugin({
      id: 'demo', version: '0.2.0-experiment', channel: 'experiment',
      sources: [makeSource({ registryUrl: 'bundled', label: 'Source A', version: '0.2.0-experiment', channel: 'experiment' })],
    })
    const { user } = setup(
      <PluginPanel plugin={plugin} installed={true} hasUpdate={false} printerId="printer-1" channelCeiling="stable"
        installedSource="bundled" installedChannel="stable" installedVersion="0.1.2" allInstalledIds={['demo']}
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    await user.click(screen.getByRole('button', { name: en('store.tab_versions') }))
    const row = screen.getByRole('button', { name: /Source A/ })
    expect(row).toHaveTextContent('v0.2.0-experiment')
    expect(row).not.toHaveTextContent('v0.1.2')
    const onPrinter = document.querySelector('.source-row.on-printer')
    expect(onPrinter).toHaveTextContent('0.1.2')
  })
})

describe('PluginPanel drifted-source listing', () => {
  it('a source that drifted ahead shows its available version; the printer build stays on the read-only on-printer row', async () => {
    // Junior repro: afc-lite 0.1.6 was installed from the bundled offline copy, which has since moved to
    // 0.1.7 (dev-tagged). The bundled row must advertise 0.1.7 (not borrow the installed 0.1.6), the
    // github source shows its own 0.1.6, and what is on the printer (0.1.6) is the read-only on-printer
    // strip. Old code showed the installed version on the bundled row and suppressed the on-printer strip.
    const plugin = makePlugin({
      id: 'demo', version: '0.1.7+dev.bb3a283c',
      sources: [
        makeSource({ registryUrl: 'bundled', label: 'Bundled', version: '0.1.7+dev.bb3a283c', local: true }),
        makeSource({ registryUrl: 'github:Bespok3d/u1-afc-lite/index.json', label: 'GitHub', version: '0.1.6', local: false }),
      ],
    })
    const { user } = setup(
      <PluginPanel plugin={plugin} installed hasUpdate printerId="printer-1"
        installedSource="bundled" installedVersion="0.1.6" allInstalledIds={['demo']}
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    await user.click(screen.getByRole('button', { name: en('store.tab_versions') }))

    const bundledRow = screen.getByRole('button', { name: /Bundled/ })
    expect(bundledRow).toHaveTextContent('v0.1.7')
    expect(bundledRow).not.toHaveTextContent('0.1.6')
    expect(bundledRow).not.toHaveTextContent('+dev')
    expect(bundledRow.querySelector('.source-installed')).toBeNull()

    expect(screen.getByRole('button', { name: /GitHub/ })).toHaveTextContent('v0.1.6')

    const onPrinter = document.querySelector('.source-row.on-printer')
    expect(onPrinter).toHaveTextContent(en('store.source_on_printer'))
    expect(onPrinter).toHaveTextContent('0.1.6')
    expect(onPrinter?.querySelector('.source-installed')).toBeTruthy()
  })
})

describe('PluginPanel install button label', () => {
  it('shows Reinstall (not Switch version) for the installed source even when the catalog version drifted', () => {
    // Screenshot repro: bundled is the installed source, but its catalog source.version (0.1.4) has
    // drifted below the device version (0.1.6). The installed row shows the device version, so the
    // primary action must read Reinstall, not Switch version.
    const plugin = makePlugin({
      id: 'demo', version: '0.1.4',
      sources: [makeSource({ registryUrl: 'bundled', label: 'Source A', version: '0.1.4' })],
    })
    setup(
      <PluginPanel plugin={plugin} installed hasUpdate={false} printerId="printer-1"
        installedSource="bundled" installedVersion="0.1.6" allInstalledIds={['demo']}
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    expect(screen.getByRole('button', { name: en('btn.reinstall') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('btn.switch_version') })).toBeNull()
  })

  it('shows Reinstall when the install is not from a listed source but the listed source is the same version', () => {
    // Screenshot repro (webcam-builtin): installed v0.1.1 "not from a listed source", and the only
    // listed source is the same v0.1.1. Selecting it is a Reinstall, not a Switch version.
    const plugin = makePlugin({
      id: 'demo', version: '0.1.1',
      sources: [makeSource({ registryUrl: 'github:org/repo/index.json', label: 'Source A', version: '0.1.1' })],
    })
    setup(
      <PluginPanel plugin={plugin} installed hasUpdate={false} printerId="printer-1"
        installedSource={undefined} installedVersion="0.1.1" allInstalledIds={['demo']}
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    expect(screen.getByRole('button', { name: en('btn.reinstall') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('btn.switch_version') })).toBeNull()
  })

  it('shows Switch version once a source other than the installed one is selected', async () => {
    const plugin = makePlugin({
      id: 'demo',
      sources: [
        makeSource({ registryUrl: 'url-a', label: 'Source A', version: '1.0.0' }),
        makeSource({ registryUrl: 'url-b', label: 'Source B', version: '1.0.0' }),
      ],
    })
    const { user } = setup(
      <PluginPanel plugin={plugin} installed hasUpdate={false} printerId="printer-1"
        installedSource="url-a" installedVersion="1.0.0" allInstalledIds={['demo']}
        onClose={vi.fn()} onOperationDone={vi.fn()} />,
      { withCatalog: true, catalog: [makeIndexEntry({ name: 'demo' })] },
    )
    expect(screen.getByRole('button', { name: en('btn.reinstall') })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('store.tab_versions') }))
    await user.click(screen.getByRole('button', { name: /Source B/ }))
    expect(screen.getByRole('button', { name: en('btn.switch_version') })).toBeInTheDocument()
  })
})
