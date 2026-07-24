import { useState } from 'react'
import type { ReleaseChannel } from '../../../data/types'
import type { CeilingResolver } from '../../../data/channels'
import { useAsyncEffect } from './useAsyncEffect'
import { useLocalStorageState } from './useLocalStorageState'

// The user's channel choices: a global primary (stability ceiling) from settings, plus per-plugin
// overrides kept in localStorage (mirroring savedPluginVars). ceilingFor resolves the effective
// ceiling for one plugin; setPref records an override. disabledChannels are global opt-outs.
export interface ChannelPrefs {
  primary: ReleaseChannel
  disabledChannels: ReleaseChannel[]
  prefs: Record<string, ReleaseChannel>
  ceilingFor: CeilingResolver
  setPref: (pluginId: string, channel: ReleaseChannel) => void
}

// The channel prefs are read by both the plugin store and the header's update badges, so the hook lives
// in the shared hooks home rather than inside the plugin-store module. Every update surface resolves the
// user's ceiling through this, so a newer build on a riskier channel is never offered as an update.
export function useChannelPrefs(): ChannelPrefs {
  const [primary, setPrimary] = useState<ReleaseChannel>('stable')
  const [disabledChannels, setDisabledChannels] = useState<ReleaseChannel[]>([])
  const [prefs, setPrefs] = useLocalStorageState<Record<string, ReleaseChannel>>('b3d.pluginChannelPrefs', {})
  useAsyncEffect(async (stale) => {
    const settings = await window.b3d.settings.get()
    if (stale()) return
    setPrimary(settings.primaryReleaseChannel ?? 'stable')
    setDisabledChannels(settings.disabledChannels ?? [])
  }, [])
  function setPref(pluginId: string, channel: ReleaseChannel) {
    setPrefs({ ...prefs, [pluginId]: channel })
  }

  return { primary, disabledChannels, prefs, ceilingFor: (pluginId) => prefs[pluginId] ?? primary, setPref }
}
