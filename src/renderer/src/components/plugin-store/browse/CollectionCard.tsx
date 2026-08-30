// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../data/types'
import type { Collection } from '../../../data/collections'
import { splitMembers, pluginBecameCollection } from '../../../data/collections'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { IconLayers } from '../../../design-system/icons'
import { TrustPill } from '../../common/badges/TrustPill'
import { StatusPill } from '../../common/badges/StatusPill'
import { ChannelPill } from '../../common/badges/ChannelPill'

// A 2x-wide store tile for a collection (`.collection-card` spans two grid columns). It reuses the
// plugin `.card` shell and shows how many of its members are already on the printer, so the user can
// tell a fresh collection from a fully-installed one at a glance. Clicking it opens the detail modal.
export function CollectionCard({ collection, plugins, collections, installedIds, onOpen }: {
  collection: Collection
  plugins: Plugin[]
  collections: Collection[]
  installedIds: string[]
  onOpen: () => void
}) {
  const { t } = useI18n()
  const split = splitMembers(collection, plugins, collections, installedIds)
  const total = split.installed.length + split.missing.length
  const installedCount = split.installed.length
  const fullyInstalled = total > 0 && installedCount === total
  // The collection's id still installed as a plugin means this was a plugin that became a collection:
  // the card carries the update pill so the pending migration is visible from the shelf.
  const became = pluginBecameCollection(collection, installedIds)

  return (
    <button data-flip-key={`collection:${collection.id}`} className={cx('card', 'collection-card', fullyInstalled && 'installed', became && 'has-update')} onClick={onOpen} type="button">
      <div className="card-top">
        <div className="card-icon col">
          <IconLayers size={24} />
        </div>
        <div className="card-heading">
          <div className="card-title">{collection.title}</div>
          <div className="card-publisher">
            <TrustPill trust={collection.trust} icon title={collection.trust} />
            <span className="card-version">v{collection.version}</span>
            {collection.channel !== 'stable' && <ChannelPill channel={collection.channel} />}
          </div>
        </div>
        {became ? <StatusPill status="update" /> : fullyInstalled && <StatusPill status="installed" />}
      </div>

      <p className="card-desc">{collection.tagline}</p>

      <div className="card-foot">
        <span className="collection-count">{t('collection.member_count', { count: total })}</span>
        <span className="collection-installed">{t('collection.installed_of', { installed: installedCount, total })}</span>
      </div>
    </button>
  )
}
