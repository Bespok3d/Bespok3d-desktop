interface LinuxTarget {
  target: string
  arch?: string[]
}

interface ElectronBuilderConfig {
  appId: string
  productName: string
  extraMetadata: { version: string }
  publish: Array<{ channel: string; releaseType: 'release' | 'prerelease' }>
  protocols: Array<{ name: string; schemes: string[] }>
  mac: {
    extendInfo: { CFBundleURLTypes: Array<{ CFBundleURLSchemes: string[] }> }
    target: Array<{ target: string; arch: string[] }>
  }
  linux: { target: LinuxTarget[] }
  flatpak: { runtimeVersion: string; baseVersion: string; finishArgs: string[] }
}

export function electronBuilderConfig(buildFlavor: string, version?: string): ElectronBuilderConfig
export default function electronBuilderConfigForEnvironment(): ElectronBuilderConfig
