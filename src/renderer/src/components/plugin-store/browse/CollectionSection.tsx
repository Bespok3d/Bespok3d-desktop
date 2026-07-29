// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../data/types'
import type { Collection } from '../../../data/collections'
import { useI18n } from '../../../i18n/context'
import { IconLayers } from '../../../design-system/icons'
import { CollectionCard } from './CollectionCard'

// The leading "Collections" shelf at the top of the store (mirrors CategorySection). Each collection is
// a 2x tile. Rendered only when there are collections; the store hides it in select mode. Collection
// cards live in their own grid so their FLIP/animation keys never collide with plugin ids.
export function CollectionSection({ collections, plugins, installedIds, onOpen }: {
  collections: Collection[]
  plugins: Plugin[]
  installedIds: string[]
  onOpen: (collection: Collection) => void
}) {
  const { t } = useI18n()
  if (collections.length === 0) return null

  return (
    <section className="category collections-section">
      <div className="category-head">
        <div className="category-title">
          <span className="cat-icon col"><IconLayers size={16} /></span>
          {t('collection.section_title')}
          <span className="cat-count">{collections.length}</span>
        </div>
        <span className="cat-sub">{t('collection.section_sub')}</span>
      </div>
      <div className="plugin-grid collections-grid">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} plugins={plugins} installedIds={installedIds} onOpen={() => onOpen(collection)} />
        ))}
      </div>
    </section>
  )
}
