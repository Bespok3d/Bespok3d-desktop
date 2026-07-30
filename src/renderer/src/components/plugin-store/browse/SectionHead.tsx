// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReactNode } from 'react'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { IconChevron } from '../../../design-system/icons'

// The heading every store shelf wears: icon + title + item count on the left, one subtitle line on the
// right. Shared by the collections shelf, the flat plugin shelf, each category and the orphan section,
// so all four stay one shape. Passing `onToggleCollapsed` adds the fold arrow beside the count.
export function SectionHead({ icon, iconClass, title, count, sub, collapsed = false, onToggleCollapsed }: {
  icon: ReactNode
  iconClass?: string
  title: string
  count: number
  sub: string
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  const { t } = useI18n()
  const foldLabel = t(collapsed ? 'store.section.expand' : 'store.section.collapse')

  return (
    <div className="category-head">
      <div className="category-title">
        <span className={cx('cat-icon', iconClass)}>{icon}</span>
        {title}
        <span className="cat-count">{count}</span>
        {onToggleCollapsed && (
          <button type="button" className={cx('section-fold', collapsed && 'is-collapsed')} onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={foldLabel} title={foldLabel}>
            <IconChevron size={16} />
          </button>
        )}
      </div>
      <span className="cat-sub">{sub}</span>
    </div>
  )
}
