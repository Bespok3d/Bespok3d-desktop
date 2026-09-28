// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'
import { Group } from '../../common/Group'
import { Button } from '../../common/Button'
import { useI18n } from '../../../i18n/context'
import type { TFunction } from '../../../i18n'
import { IconPlus } from '../../../design-system/icons'
import { Toggle } from '../../common/Toggle'
import { CHANNELS } from '../../../data/catalog/bundled'
import { useCatalog } from '../../../data/catalog'
import { allowsChannel } from '../../../data/channels'
import type { Channel, ReleaseChannel } from '../../../data/types'
import cx from '../../../utils/cx'
import { RepositorySourceRow } from './source-row'
import { useAsyncResource } from '../../common/hooks/useAsyncResource'

function useRepoSettings() {
  // primaryChannel is the stability CEILING; disabledChannels are explicit opt-outs within it.
  const [primaryChannel, setPrimaryChannel] = useState<ReleaseChannel>('stable')
  const [disabledChannels, setDisabledChannels] = useState<ReleaseChannel[]>([])
  useEffect(() => {
    window.b3d.settings.get().then((settings) => {
      setPrimaryChannel(settings.primaryReleaseChannel ?? 'stable')
      setDisabledChannels(settings.disabledChannels ?? [])
    })
  }, [])

  function selectPrimary(id: ReleaseChannel) {
    setPrimaryChannel(id)
    window.b3d.settings.set({ primaryReleaseChannel: id })
  }

  function toggleChannel(id: ReleaseChannel, enabled: boolean) {
    window.b3d.registry.setChannelEnabled(id, enabled).then((settings) => setDisabledChannels(settings.disabledChannels ?? []))
  }

  return { primaryChannel, disabledChannels, selectPrimary, toggleChannel }
}

interface ChannelRowProps {
  channel: Channel
  primary: ReleaseChannel
  disabledChannels: ReleaseChannel[]
  t: TFunction
  onSetPrimary: (id: ReleaseChannel) => void
  onToggle: (id: ReleaseChannel, enabled: boolean) => void
}

function ChannelRow({ channel, primary, disabledChannels, t, onSetPrimary, onToggle }: ChannelRowProps) {
  const withinCeiling = allowsChannel(primary, channel.id)
  const isPrimary = primary === channel.id
  const active = withinCeiling && !disabledChannels.includes(channel.id)

  return (
    <div className={cx('set-row repo-chan-row', !withinCeiling && 'disabled')}>
      <div className="chan-mark" data-tone={channel.tone}>{channel.short[0]}</div>
      <div className="set-row-text">
        <div className="set-row-label">
          {t(`chan.${channel.id}`)}
          {isPrimary && <span className="chan-pill compact" data-tone={channel.tone}>{t('repos.primary')}</span>}
        </div>
        <div className="set-row-hint">{t(`chan.${channel.id}.desc`)}</div>
      </div>
      <div className="set-row-control">
        {!isPrimary && (
          <Button variant="ghost" size="sm" onClick={() => onSetPrimary(channel.id)}>{t('repos.set_primary')}</Button>
        )}
        <Toggle on={active} disabled={isPrimary || !withinCeiling} onChange={(next) => onToggle(channel.id, next)} />
      </div>
    </div>
  )
}

export function RepositoriesPane({ onConnectGitHub }: { onConnectGitHub?: () => void }) {
  const { t } = useI18n()
  const { sources, setSourceEnabled } = useCatalog()
  const { primaryChannel, disabledChannels, selectPrimary, toggleChannel } = useRepoSettings()
  const { value: gitHubConnected } = useAsyncResource(() => window.b3d.gitHost.isConnected(), [])

  return (
    <>
      <Group title={t('repos.channels')}>
        {CHANNELS.map((channel) => (
          <ChannelRow
            key={channel.id}
            channel={channel}
            primary={primaryChannel}
            disabledChannels={disabledChannels}
            t={t}
            onSetPrimary={selectPrimary}
            onToggle={toggleChannel}
          />
        ))}
      </Group>

      <Group
        title={`${t('repos.sources')} · ${sources.length}`}
        action={
          <Button variant="outline" size="sm" disabled title={t('repos.add_hint')}>
            <IconPlus size={12} />{t('repos.add')}
          </Button>
        }
      >
        {sources.map((source) => (
          <RepositorySourceRow key={source.url} source={source} gitHubConnected={gitHubConnected !== false} t={t} onToggle={(enabled) => setSourceEnabled(source.url, enabled)} onConnectGitHub={() => onConnectGitHub?.()} />
        ))}
      </Group>
    </>
  )
}
