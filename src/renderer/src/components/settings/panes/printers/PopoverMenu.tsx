// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import cx from '../../../../utils/cx'
import { useClickOutside } from '../../../common/hooks/useClickOutside'
import { IconChevron } from '../../../../design-system/icons'

interface PopoverMenuProps {
  label: ReactNode
  title?: string
  triggerVariant?: 'outline' | 'primary'
  children: (close: () => void) => ReactNode
}

// A small click-to-open menu: a button trigger plus a popup list of `menu-action` items. Shared by the
// printer row's Force and Deploy menus so the open-state + close-on-outside-press + popup chrome live in
// one place. The children render-prop receives a `close` so each item can dismiss the menu after acting.
export function PopoverMenu({ label, title, triggerVariant = 'outline', children }: PopoverMenuProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapRef, () => setOpen(false), open)

  return (
    <div className="popover-menu" ref={wrapRef}>
      <button className={cx('btn sm popover-menu-trigger', triggerVariant, open && 'active')} title={title} onClick={() => setOpen((prev) => !prev)}>
        {label} <IconChevron size={12} />
      </button>
      {open && <div className="popover-menu-pop">{children(() => setOpen(false))}</div>}
    </div>
  )
}
