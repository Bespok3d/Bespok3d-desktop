import { randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { readJsonFile } from './json-store'
import { userDataPath } from './app-paths'
import type { UpdateFrequency } from './app-update/schedule'

export interface RepoCoords {
  owner: string
  repo: string
}

// Mirror of the renderer's ReleaseChannel (data/types.ts). Main never imports renderer code, so the
// five-member vocabulary is duplicated here the same way RegistryTrust mirrors TrustTier.
export type ReleaseChannel = 'lts' | 'stable' | 'rc' | 'testing' | 'experiment'

export interface AppSettings {
  pgpEnabled: boolean
  // Show the signature-derived trust badge (tier 'unknown' on a failed/missing check) in the
  // Repositories pane. Display only, never gates trust-tier computation itself.
  verifySignatures: boolean
  clientId: string
  // electron-updater source; unset = in-app auto-update disabled (the default until the app repo
  // exists). Set to enable updates from that repo's releases via the keychain GitHub token. (The
  // plugin catalog source is the Git Host "List repositories", not here.)
  appUpdateRepo?: RepoCoords
  // How often to poll for an app update (the Settings > Update pane). 'launch' checks once per run,
  // 'manual' never auto-checks.
  appUpdateFrequency: UpdateFrequency
  // Download an available update automatically (vs notify and wait for a manual download).
  appUpdateAutoDownload: boolean
  // Apply a downloaded update silently on the next quit (vs prompt to restart and apply now).
  appUpdateInstallOnQuit: boolean
  // The app version that ran last launch. When the running version differs, an update (or rollback)
  // landed, so the UI shows a one-time "you are now running X" confirmation.
  lastRunVersion?: string
  // Which workbench layout the Create surface shows. A self-select A/B test for testers (A = section
  // tabs + coach rail, B = section rail + coach drawer). Removable once a direction is chosen.
  workbenchLayout: 'A' | 'B'
  // Plugin sources the user has switched off in the Repositories pane, keyed by registry url. A
  // disabled source is left out of the catalog fetch but still listed (as off) so it can be undone.
  disabledSources?: string[]
  // The global default release channel: a stability CEILING, not an exact pick. The store offers the
  // newest variant of each plugin at-or-stabler than this (data/channels.ts effectiveVariant). A
  // per-plugin override (renderer localStorage) can raise or lower it for one plugin.
  primaryReleaseChannel?: ReleaseChannel
  // Channels the user explicitly opted out of, excluded even when at-or-stabler than the ceiling.
  disabledChannels?: ReleaseChannel[]
  // Display preferences persisted across launches (previously renderer-only state lost on reload).
  // theme is the user's pick; the renderer resolves 'system' against the OS at runtime.
  theme?: 'light' | 'dark' | 'system'
  density?: 'compact' | 'comfortable' | 'spacious'
  // Whether the plugin store groups cards by category. uiLocale unset = follow the OS locale.
  storeGrouped?: boolean
  uiLocale?: string
}

const DEFAULTS: AppSettings = {
  pgpEnabled: false,
  verifySignatures: false,
  clientId: '',
  appUpdateFrequency: 'daily',
  appUpdateAutoDownload: false,
  appUpdateInstallOnQuit: true,
  workbenchLayout: 'A',
  primaryReleaseChannel: 'stable',
  theme: 'system',
  density: 'comfortable',
  storeGrouped: false,
}

function settingsPath(): string {
  return userDataPath('settings.json')
}

export function loadSettings(): AppSettings {
  return { ...DEFAULTS, ...readJsonFile<Partial<AppSettings>>(settingsPath(), {}) }
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...loadSettings(), ...patch }
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2))

  return next
}

// Switch a plugin source on or off by registry url. Off adds it to disabledSources; on removes it.
export function setSourceEnabled(url: string, enabled: boolean): AppSettings {
  const without = (loadSettings().disabledSources ?? []).filter((entry) => entry !== url)

  return saveSettings({ disabledSources: enabled ? without : [...without, url] })
}

// Switch a release channel on or off. Off adds it to disabledChannels (excluded even when within the
// ceiling); on removes it. The primary channel itself is a plain scalar set via the generic settings:set.
export function setChannelEnabled(channel: ReleaseChannel, enabled: boolean): AppSettings {
  const without = (loadSettings().disabledChannels ?? []).filter((entry) => entry !== channel)

  return saveSettings({ disabledChannels: enabled ? without : [...without, channel] })
}

// A stable identity for this computer when PGP is off, generated once and persisted. Lets a printer
// ACL name and revoke this client without a GPG key.
export function clientId(): string {
  const current = loadSettings().clientId
  if (current) return current
  const generated = `client-${randomBytes(8).toString('hex')}`
  saveSettings({ clientId: generated })

  return generated
}
