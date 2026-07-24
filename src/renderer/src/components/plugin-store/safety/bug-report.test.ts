import { describe, expect, it } from 'vitest'

import type { Plugin, Printer } from '../../../data/types'
import { buildBugReport, repoIssueUrl } from './bug-report'

const plugin = {
  id: 'moonraker-notify', version: '0.1.0', publisher: 'Bespok3d',
  sources: [{ registryUrl: 'github:Bespok3d/u1-extras/index.json' }],
} as unknown as Plugin

const printer = { daemonVersion: '0.11.0-dev', adapter: 'snapmaker-u1', jinniVersion: '0.1.1', model: 'Snapmaker U1', firmwareVersion: '1.4.0.246' } as unknown as Printer

describe('buildBugReport', () => {
  it('includes the plugin, environment, failure and log', () => {
    const report = buildBugReport({ plugin, printer, detail: 'notifier failed to load', log: 'boom' })
    expect(report).toContain('id: moonraker-notify')
    expect(report).toContain('daemon: 0.11.0-dev')
    expect(report).toContain('firmware: 1.4.0.246')
    expect(report).toContain('notifier failed to load')
    expect(report).toContain('boom')
  })

  it('keeps both service tails so a moonraker traceback is not dropped, within the URL budget', () => {
    const klipper = `--- Klipper log ---\n${'klipper noise\n'.repeat(4000)}`
    const moonraker = `--- Moonraker log ---\n${'moonraker noise\n'.repeat(4000)}MOONRAKER_TRACEBACK import apprise`
    const report = buildBugReport({ plugin, printer, detail: 'notifier failed', log: `${klipper}\n\n${moonraker}` })
    expect(report).toContain('--- Klipper log ---')
    expect(report).toContain('MOONRAKER_TRACEBACK import apprise')
    expect(report.length).toBeLessThan(6000)
  })
})

describe('repoIssueUrl', () => {
  it('builds a prefilled GitHub new-issue URL from a github: source', () => {
    const url = repoIssueUrl(plugin, 'title', 'body')
    expect(url).toContain('https://github.com/Bespok3d/u1-extras/issues/new?')
    expect(url).toContain('title=title')
  })

  it('returns null when the source is not a github ref', () => {
    const local = { ...plugin, sources: [{ registryUrl: 'local:bundled' }] } as unknown as Plugin
    expect(repoIssueUrl(local, 't', 'b')).toBeNull()
  })
})
