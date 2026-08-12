// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef } from 'react'

// Keeps the row being worked on in view. A run longer than the modal scrolls itself as each plugin
// starts, so the list follows the work instead of the user chasing it.
export function useListFollowsActiveRow(activeIndex: number) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(function scrollActiveRowIntoView() {
    const activeRow = listRef.current?.children[activeIndex]
    activeRow?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return listRef
}
