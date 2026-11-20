// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { buildNotices } from './notices'
import type { Plugin, ReleaseChannel, SourceRow } from '../../data/types'

function src(overrides: Partial<SourceRow>): SourceRow {
  return { url: 'github:o/r/index.json', label: 'l', name: 'n', trust: 'project', locked: true, enabled: true, status: 'ok', pluginCount: 1, error: null, reason: null, ...overrides }
}

function plugin(id: string, version: string): Plugin {
  return { id, name: id, title: id.toUpperCase(), version } as Plugin
}

// A plugin that publishes the same version on several channels, so a test can pick a ceiling and assert
// which variant the notice resolves to. topVersion is the plugin's top-line field, kept distinct
// from the newest channel build to catch a label that reads it instead of the effective variant.
function channelPlugin(id: string, topVersion: string, variants: Array<{ version: string; channel: ReleaseChannel }>): Plugin {
  return {
    id, name: id, title: id.toUpperCase(), version: topVersion,
    sources: variants.map((variant) => ({ ...variant, registryUrl: 'github:o/r/index.json', trust: 'project' })),
  } as Plugin
}

function inputs(overrides: Partial<Parameters<typeof buildNotices>[0]> = {}) {
  return { sources: [], plugins: [], installedVersions: {}, ...overrides }
}

describe('buildNotices', () => {
  it('emits nothing when nothing needs attention', () => {
    expect(buildNotices(inputs({ sources: [src({})] }))).toEqual([])
  })

  it('emits an auth notice with a git-host action when a source failed for access', () => {
    const notices = buildNotices(inputs({ sources: [src({ status: 'failed', reason: 'auth', error: 'sign in' })] }))
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({ id: 'sources-need-auth', severity: 'warn', action: { kind: 'open-settings', pane: 'git-host' } })
  })

  it('ignores non-auth source failures so a network blip is not a sign-in prompt', () => {
    expect(buildNotices(inputs({ sources: [src({ status: 'failed', reason: 'network', error: 'x' })] }))).toEqual([])
  })
})

describe('buildNotices update notices', () => {
  it('emits one update notice per plugin whose installed version is behind the catalog', () => {
    const notices = buildNotices(inputs({
      plugins: [plugin('spoolman', '0.2.0'), plugin('fluidd', '1.0.0')],
      installedVersions: { spoolman: '0.1.0', fluidd: '1.0.0' },
    }))
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      id: 'plugin-update:spoolman:0.2.0',
      severity: 'info',
      action: { kind: 'open-plugin', pluginId: 'spoolman' },
    })
    expect(notices[0].params).toMatchObject({ name: 'SPOOLMAN', installed: '0.1.0', version: '0.2.0' })
  })

  it('keys the update id by target version so a new release reappears after a dismiss', () => {
    const firstRelease = buildNotices(inputs({ plugins: [plugin('x', '0.2.0')], installedVersions: { x: '0.1.0' } }))
    const nextRelease = buildNotices(inputs({ plugins: [plugin('x', '0.3.0')], installedVersions: { x: '0.1.0' } }))
    expect(firstRelease[0].id).not.toBe(nextRelease[0].id)
  })

  it('keys the update id by build so a same-version rebuild reappears after a dismiss', () => {
    const rebuilt = { ...channelPlugin('x', '0.2.0', [{ version: '0.2.0', channel: 'stable' }]) }
    rebuilt.sources = rebuilt.sources?.map((source) => ({ ...source, fingerprint: 'sha256:build-two' }))
    const notices = buildNotices(inputs({ plugins: [rebuilt], installedVersions: { x: '0.2.0' }, installedFingerprints: { x: 'sha256:build-one' } }))
    expect(notices).toHaveLength(1)
    expect(notices[0].id).toBe('plugin-update:x:0.2.0:sha256:build-two')
  })

  it('does not emit an update notice when the installed version is ahead of the catalog', () => {
    expect(buildNotices(inputs({ plugins: [plugin('camera-hw-accel', '0.1.0')], installedVersions: { 'camera-hw-accel': '0.1.2' } }))).toEqual([])
  })

  it('labels the update action by whether the plugin actually ships a changelog', () => {
    const withLog = buildNotices(inputs({ plugins: [{ ...plugin('a-plugin', '0.2.0'), changelog: 'CHANGELOG.md' } as Plugin], installedVersions: { 'a-plugin': '0.1.0' } }))
    const noLog = buildNotices(inputs({ plugins: [plugin('b-plugin', '0.2.0')], installedVersions: { 'b-plugin': '0.1.0' } }))
    expect(withLog[0].action?.labelKey).toBe('notif.update.action')
    expect(noLog[0].action?.labelKey).toBe('notif.update.action_plugin')
  })
})

describe('buildNotices channel-aware updates', () => {
  it('does not offer a newer build that sits on a channel riskier than the user chose', () => {
    const spoolman = channelPlugin('spoolman', '0.1.5', [
      { version: '0.1.5', channel: 'stable' },
      { version: '0.1.6', channel: 'testing' },
    ])
    const notices = buildNotices(inputs({ plugins: [spoolman], installedVersions: { spoolman: '0.1.5' }, ceilingFor: () => 'stable' }))
    expect(notices).toEqual([])
  })

  it('labels the target from the effective variant, not the plugin top-line version', () => {
    const spoolman = channelPlugin('spoolman', '0.1.5', [
      { version: '0.1.5', channel: 'stable' },
      { version: '0.1.6', channel: 'testing' },
    ])
    const notices = buildNotices(inputs({ plugins: [spoolman], installedVersions: { spoolman: '0.1.5' }, ceilingFor: () => 'testing' }))
    expect(notices).toHaveLength(1)
    expect(notices[0].id).toBe('plugin-update:spoolman:0.1.6')
    expect(notices[0].params).toMatchObject({ installed: '0.1.5', version: '0.1.6' })
  })
})

const LIVE_URL = 'github:Bespok3d/main-index/index.json'
const DEV_URL = `${LIVE_URL}?ref=dev`

// The demo plugin as the live list and the dev list publish it, each list under its Repositories name.
function demoOnBothLists(liveVersion: string, devVersion: string): Plugin {
  return {
    id: 'demo', name: 'demo', title: 'Demo', version: liveVersion,
    sources: [
      { registryUrl: LIVE_URL, label: 'Bespok3d Official', version: liveVersion, fingerprint: 'live-fp', channel: 'stable', trust: 'project' },
      { registryUrl: DEV_URL, label: 'Bespok3d Official prerelease', version: devVersion, fingerprint: 'dev-fp', channel: 'testing', trust: 'project' },
    ],
  } as Plugin
}

function installedFrom(installedSource: string, version: string, fingerprint: string) {
  return inputs({ installedVersions: { demo: version }, installedSources: { demo: installedSource }, installedFingerprints: { demo: fingerprint } })
}

describe('buildNotices update from another list', () => {
  it('names the offering list and both versions, and opens Versions on that list', () => {
    const [notice] = buildNotices({ ...installedFrom(LIVE_URL, '0.1.9', 'live-fp'), plugins: [demoOnBothLists('0.1.9', '0.2.0-pre')] })

    expect(notice.bodyKey).toBe('notif.update.other_list_body')
    expect(notice.params).toEqual({ list: 'Bespok3d Official prerelease', name: 'Demo', installed: '0.1.9', version: '0.2.0-pre' })
    expect(notice.action).toMatchObject({ kind: 'open-plugin', pluginId: 'demo', view: { tab: 'versions', variantKey: `${DEV_URL}::testing` } })
  })

  it('names the offering list in the id, so dismissing it never hides the same version from another list', () => {
    const [notice] = buildNotices({ ...installedFrom(LIVE_URL, '0.1.9', 'live-fp'), plugins: [demoOnBothLists('0.1.9', '0.2.0-pre')] })

    expect(notice.id).toBe(`plugin-update:demo:0.2.0-pre:dev-fp:${DEV_URL}`)
  })

  it('offers the switch back to the live copy through the same notice once live releases it', () => {
    const [notice] = buildNotices({ ...installedFrom(DEV_URL, '0.1.9-pre', 'dev-fp'), plugins: [demoOnBothLists('0.1.9', '0.1.9-pre')] })

    expect(notice.bodyKey).toBe('notif.update.other_list_body')
    expect(notice.id).toBe(`plugin-update:demo:0.1.9:live-fp:${LIVE_URL}`)
    expect(notice.params).toMatchObject({ list: 'Bespok3d Official', installed: '0.1.9-pre', version: '0.1.9' })
    expect(notice.action).toMatchObject({ view: { tab: 'versions', variantKey: `${LIVE_URL}::stable` } })
  })

  it('keeps the plain notice, with no view, for an update from the list the copy came from', () => {
    const [notice] = buildNotices({ ...installedFrom(LIVE_URL, '0.1.8', 'old-fp'), plugins: [demoOnBothLists('0.1.9', '0.1.9-pre')] })

    expect(notice.bodyKey).toBe('notif.update.body')
    expect(notice.action).not.toHaveProperty('view')
  })
})
