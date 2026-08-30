// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../data/types'
import type { Collection } from '../../../data/collections'
import { useI18n } from '../../../i18n/context'
import { IconLayers } from '../../../design-system/icons'
import { useLocalStorageState } from '../../common/hooks/useLocalStorageState'
import { SectionHead } from './SectionHead'
import { CollectionCard } from './CollectionCard'

// Remembered across sessions: someone who browses plugins folds the shelf away once, not once a day.
const COLLECTIONS_FOLDED_KEY = 'b3d.store.collections_collapsed'

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
  const [collapsed, setCollapsed] = useLocalStorageState(COLLECTIONS_FOLDED_KEY, false)
  if (collections.length === 0) return null

  return (
    <section className="category collections-section">
      <SectionHead
        icon={<IconLayers size={16} />} iconClass="col" title={t('collection.section_title')} count={collections.length} sub={t('collection.section_sub')}
        collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
      {!collapsed && (
        <div className="plugin-grid collections-grid">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} plugins={plugins} collections={collections} installedIds={installedIds} onOpen={() => onOpen(collection)} />
          ))}
        </div>
      )}
    </section>
  )
}
