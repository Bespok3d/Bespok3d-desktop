export interface BuildChannel {
  buildFlavor: string
  appId: string
  productName: string
  appName: string
  scheme: string
  indexAssets: string[]
  updateRule: string
  updateChannel: string
  releaseType: 'release' | 'prerelease'
  versionSuffix: string | null
  versionLabels: string[] | null
  transitionFromProfile: string | null
}

export function channelFor(buildFlavor: string): BuildChannel
export function versionLabel(version: string): string
export function liveVersion(version: string): string
export function versionForChannel(buildFlavor: string, version: string): string
export function versionLabelError(buildFlavor: string, version: string): string | null
export function channelArtifacts(productName: string): {
  macDmg: (version: string) => string
  windowsSetup: (version: string) => string
  linuxPackage: (version: string) => string
}
export function primaryIndexAsset(channel: { indexAssets: string[] }): string
