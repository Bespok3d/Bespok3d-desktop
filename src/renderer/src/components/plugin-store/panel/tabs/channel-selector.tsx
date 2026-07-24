import type { Plugin, ReleaseChannel } from '../../../../data/types'
import type { TFunction } from '../../../../i18n'
import cx from '../../../../utils/cx'
import { allowsChannel, publishedChannels } from '../../../../data/channels'
import { ChannelPill } from '../../../common/badges/ChannelPill'

// The per-plugin channel picker shown above the source rows when the plugin publishes more than one
// channel. Channels riskier than the user's ceiling are marked, but still selectable (an explicit opt-in).
export function ChannelSelector({ plugin, ceiling, channelFilter, onPick, t }: {
  plugin: Plugin; ceiling: ReleaseChannel; channelFilter: ReleaseChannel | 'all'; onPick: (channel: ReleaseChannel | 'all') => void; t: TFunction
}) {
  const channels = publishedChannels(plugin)
  if (channels.length < 2) return null

  return (
    <div className="channel-selector">
      <div className="panel-sources-title">{t('store.channel')}</div>
      <div className="filter-group">
        <button type="button" className={cx('filter-chip', channelFilter === 'all' && 'active')} onClick={() => onPick('all')}>
          {t('filter.all')}
        </button>
        {channels.map((channel) => {
          const aboveCeiling = !allowsChannel(ceiling, channel)

          return (
            <button key={channel} type="button" title={aboveCeiling ? t('store.channel_above_ceiling') : undefined}
              className={cx('filter-chip', channel === channelFilter && 'active', aboveCeiling && 'above-ceiling')} onClick={() => onPick(channel)}>
              <ChannelPill channel={channel} />
            </button>
          )
        })}
      </div>
      <div className="panel-sources-hint">{t('store.channel_docs_deferred')}</div>
    </div>
  )
}
