// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure builder for the notification center. Each subsystem's "stick it in the user's face" state is
// DERIVED from app data here, so the center is one truthful aggregator instead of banners scattered
// around the UI. Adding a consumer = adding a derivation, not a new banner. All inputs are plain data
// so this stays unit-testable without React. Actions are descriptors (not closures) so the builder is
// pure; the NotificationCenter maps a descriptor to a real handler.
import type { Plugin, ReleaseChannel, SourceRow } from '../../data/types'
import type { Section } from '../settings'
import { updatablePlugins } from '../plugin-store/update-all'
import { installedFromRecords, updateTargetVersion } from '../../data/channels/updates'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import type { CeilingResolver } from '../../data/channels'

export type NoticeSeverity = 'info' | 'warn' | 'error'

export type NoticeAction =
  | { kind: 'open-settings'; pane: Section; labelKey: string }
  | { kind: 'open-plugin'; pluginId: string; labelKey: string }

export interface Notice {
  id: string
  severity: NoticeSeverity
  titleKey: string
  bodyKey: string
  params?: Record<string, string | number>
  action?: NoticeAction
}

export interface NoticeInputs {
  sources: SourceRow[]
  plugins: Plugin[]
  installedVersions: Record<string, string>
  installedSources?: Record<string, string>
  ceilingFor?: CeilingResolver
  disabledChannels?: ReleaseChannel[]
}

// Live-condition notices reflect an ongoing state, not a one-off event, so the NotificationCenter
// re-arms them once per session: a still-broken condition nags again even if read/dismissed before.
export const SOURCES_NEED_AUTH_ID = 'sources-need-auth'
export const LIVE_CONDITION_NOTICE_IDS = [SOURCES_NEED_AUTH_ID]

// A private source the user cannot read yet: offer a one-click sign-in rather than letting the list
// silently fall out of the catalog.
function authNotice(sources: SourceRow[]): Notice | null {
  const locked = sources.filter((source) => source.status === 'failed' && source.reason === 'auth')
  if (locked.length === 0) return null

  return {
    id: SOURCES_NEED_AUTH_ID,
    severity: 'warn',
    titleKey: 'notif.auth.title',
    bodyKey: 'notif.auth.body',
    params: { count: locked.length },
    action: { kind: 'open-settings', pane: 'git-host', labelKey: 'repos.sign_in' },
  }
}

// One notice per installed plugin whose build on the user's channel is strictly newer. Both the filter
// and the displayed target are the effective variant at that ceiling, so a riskier-channel build the
// user never opted into is neither offered nor shown as "update to the version you already run". The id
// carries the target version so dismissing one update never suppresses the next release. Acting on it
// opens the plugin; the label promises the changelog only when the plugin actually ships one.
function updateNotices(plugins: Plugin[], installed: InstalledOnPrinter): Notice[] {
  return updatablePlugins(plugins, installed).map((plugin) => {
    const target = updateTargetVersion(plugin, installed)

    return {
      id: `plugin-update:${plugin.id}:${target}`,
      severity: 'info',
      titleKey: 'notif.update.title',
      bodyKey: 'notif.update.body',
      params: { name: plugin.title, installed: installed.versions[plugin.id], version: target ?? '' },
      action: { kind: 'open-plugin', pluginId: plugin.id, labelKey: plugin.changelog ? 'notif.update.action' : 'notif.update.action_plugin' },
    }
  })
}

export function buildNotices(inputs: NoticeInputs): Notice[] {
  const auth = authNotice(inputs.sources)
  const updates = updateNotices(inputs.plugins, installedFromRecords(inputs.installedVersions, inputs.installedSources, inputs.ceilingFor, inputs.disabledChannels))

  return auth ? [auth, ...updates] : updates
}
