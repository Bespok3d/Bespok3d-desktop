import type { Plugin, PluginSource, ReleaseChannel } from '../types'
import { isNewerVersion } from '../../utils/version'

// Most-stable to least-stable. A user's chosen channel is a ceiling, not an exact pick: they accept
// builds at this rank or stabler, never riskier. So a plugin that only ships `stable` is still
// offered to someone whose ceiling is `experiment` (stable is stabler than experiment).
const STABILITY_RANK: Record<ReleaseChannel, number> = {
  lts: 0,
  stable: 1,
  rc: 2,
  testing: 3,
  experiment: 4,
}

const SOURCE_TRUST_RANK: Record<PluginSource['trust'], number> = {
  manufacturer: 3,
  project: 2,
  community: 1,
  any: 0,
  unknown: -1,
}

export function allowsChannel(ceiling: ReleaseChannel, channel: ReleaseChannel): boolean {
  return STABILITY_RANK[channel] <= STABILITY_RANK[ceiling]
}

function sourceWins(candidate: PluginSource, current: PluginSource): boolean {
  if (isNewerVersion(candidate.version, current.version)) return true
  if (isNewerVersion(current.version, candidate.version)) return false

  return SOURCE_TRUST_RANK[candidate.trust] > SOURCE_TRUST_RANK[current.trust]
}

// The single source (version + channel) the store would display and install for this plugin at the
// given ceiling: the newest variant at-or-stabler than the ceiling, with trust breaking a version
// tie. Returns undefined when the plugin publishes nothing within the ceiling, in which case the
// caller hides the card unless a channel filter facet explicitly surfaces it.
export function effectiveVariant(
  plugin: Plugin,
  ceiling: ReleaseChannel,
  disabledChannels: ReleaseChannel[] = [],
): PluginSource | undefined {
  const blocked = new Set(disabledChannels)
  const eligible = (plugin.sources ?? []).filter(
    (source) => allowsChannel(ceiling, source.channel) && !blocked.has(source.channel),
  )

  return eligible.reduce<PluginSource | undefined>(
    (best, source) => (!best || sourceWins(source, best) ? source : best),
    undefined,
  )
}

export function publishedChannels(plugin: Plugin): ReleaseChannel[] {
  return [...new Set(plugin.sources.map((source) => source.channel))]
}

// The version a user would actually get for this plugin at the given ceiling (the effective variant's
// version), falling back to the plugin's own when nothing is within the ceiling. Update detection
// compares THIS against the installed version, so an upgrade on a riskier channel than the user's pick
// is not mistaken for an available update.
export function availableVersion(plugin: Plugin, ceiling: ReleaseChannel, disabledChannels: ReleaseChannel[] = []): string {
  return effectiveVariant(plugin, ceiling, disabledChannels)?.version ?? plugin.version
}

// Resolves the stability ceiling for a plugin id (a global primary, optionally overridden per plugin).
export type CeilingResolver = (pluginId: string) => ReleaseChannel

// The permissive default: allow every channel (pick the absolute newest variant). Update surfaces that
// do not yet thread the user's real ceiling use this, matching the pre-channel winner behaviour.
export function ALLOW_ALL_CHANNELS(): ReleaseChannel {
  return 'experiment'
}
