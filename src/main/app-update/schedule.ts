import type { AssetInfo } from '../git-host/connector'

// Pure helpers for the update preferences: how often to poll for updates, and which release asset
// is the installer for this machine (used by manual rollback to a chosen version).

export type UpdateFrequency = 'launch' | 'daily' | 'weekly' | 'manual'

const DAY_MS = 24 * 60 * 60 * 1000

// null means "no periodic poll": 'launch' checks once at startup, 'manual' only on demand.
export function checkIntervalMs(frequency: UpdateFrequency): number | null {
  if (frequency === 'daily') return DAY_MS
  if (frequency === 'weekly') return 7 * DAY_MS

  return null
}

const INSTALLER_EXTENSION: Record<string, string> = {
  darwin: '.dmg',
  win32: '.exe',
  linux: '.appimage',
}

function archTokens(arch: string): string[] {
  if (arch === 'arm64') return ['arm64', 'aarch64']
  if (arch === 'x64') return ['x64', 'x86_64', 'amd64']

  return [arch]
}

export function pickPlatformAsset(assets: AssetInfo[], platform: string, arch: string): AssetInfo | null {
  const extension = INSTALLER_EXTENSION[platform]
  if (!extension) return null
  const matches = assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))
  if (matches.length === 0) return null
  const tokens = archTokens(arch)
  const archMatch = matches.find((asset) => tokens.some((token) => asset.name.toLowerCase().includes(token)))

  return archMatch ?? matches[0]
}
