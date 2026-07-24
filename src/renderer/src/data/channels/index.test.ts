import { describe, it, expect } from 'vitest'
import { allowsChannel, effectiveVariant, publishedChannels, availableVersion } from './index'
import { makePlugin, makeSource } from '../../test/fixtures'

describe('allowsChannel', () => {
  it('admits the ceiling channel and every stabler one', () => {
    expect(allowsChannel('rc', 'lts')).toBe(true)
    expect(allowsChannel('rc', 'stable')).toBe(true)
    expect(allowsChannel('rc', 'rc')).toBe(true)
  })

  it('rejects channels riskier than the ceiling', () => {
    expect(allowsChannel('rc', 'testing')).toBe(false)
    expect(allowsChannel('rc', 'experiment')).toBe(false)
    expect(allowsChannel('stable', 'rc')).toBe(false)
  })
})

describe('effectiveVariant', () => {
  it('picks the newest variant at or stabler than the ceiling', () => {
    const plugin = makePlugin({
      sources: [
        makeSource({ registryUrl: 's', channel: 'stable', version: '1.0.0' }),
        makeSource({ registryUrl: 's', channel: 'experiment', version: '2.0.0' }),
      ],
    })
    expect(effectiveVariant(plugin, 'stable')?.version).toBe('1.0.0')
    expect(effectiveVariant(plugin, 'experiment')?.version).toBe('2.0.0')
  })

  it('still offers a stable-only plugin under a riskier ceiling', () => {
    const plugin = makePlugin({ sources: [makeSource({ channel: 'stable', version: '1.2.3' })] })
    expect(effectiveVariant(plugin, 'experiment')?.channel).toBe('stable')
  })

  it('returns undefined when nothing is at or below the ceiling', () => {
    const plugin = makePlugin({ sources: [makeSource({ channel: 'experiment', version: '1.0.0' })] })
    expect(effectiveVariant(plugin, 'stable')).toBeUndefined()
  })
})

describe('effectiveVariant: disabled channels and tie-breaks', () => {
  it('excludes a channel the user explicitly disabled', () => {
    const plugin = makePlugin({
      sources: [
        makeSource({ registryUrl: 'a', channel: 'lts', version: '1.0.0' }),
        makeSource({ registryUrl: 'b', channel: 'stable', version: '1.1.0' }),
      ],
    })
    expect(effectiveVariant(plugin, 'stable', ['stable'])?.channel).toBe('lts')
  })

  it('breaks a version tie by source trust', () => {
    const plugin = makePlugin({
      sources: [
        makeSource({ registryUrl: 'community', channel: 'stable', version: '1.0.0', trust: 'community' }),
        makeSource({ registryUrl: 'official', channel: 'stable', version: '1.0.0', trust: 'project' }),
      ],
    })
    expect(effectiveVariant(plugin, 'stable')?.registryUrl).toBe('official')
  })

  it('returns undefined for an orphan with no sources', () => {
    expect(effectiveVariant(makePlugin({ sources: [] }), 'experiment')).toBeUndefined()
  })
})

describe('availableVersion', () => {
  function dualChannel() {
    return makePlugin({
      version: '2.0.0',
      sources: [
        makeSource({ registryUrl: 's', channel: 'stable', version: '1.0.0' }),
        makeSource({ registryUrl: 's', channel: 'experiment', version: '2.0.0' }),
      ],
    })
  }

  it('is the stable version under a stable ceiling, even though a newer experiment build exists', () => {
    expect(availableVersion(dualChannel(), 'stable')).toBe('1.0.0')
  })

  it('is the experiment version under an experiment ceiling', () => {
    expect(availableVersion(dualChannel(), 'experiment')).toBe('2.0.0')
  })

  it('falls back to the plugin version when no variant is within the ceiling', () => {
    const experimentOnly = makePlugin({ version: '3.0.0', sources: [makeSource({ channel: 'experiment', version: '2.0.0' })] })
    expect(availableVersion(experimentOnly, 'stable')).toBe('3.0.0')
  })
})

describe('publishedChannels', () => {
  it('lists the distinct channels a plugin offers', () => {
    const plugin = makePlugin({
      sources: [
        makeSource({ registryUrl: 'a', channel: 'stable' }),
        makeSource({ registryUrl: 'b', channel: 'stable' }),
        makeSource({ registryUrl: 'c', channel: 'experiment' }),
      ],
    })
    expect(publishedChannels(plugin)).toEqual(['stable', 'experiment'])
  })
})
