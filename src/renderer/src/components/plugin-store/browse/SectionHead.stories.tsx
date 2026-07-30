// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { IconBox, IconLayers } from '../../../design-system/icons'
import { SectionHead } from './SectionHead'
import '../plugin-store.css'

export default { title: 'Store / SectionHead' }

export function PlainHead() {
  return (
    <div className="main">
      <SectionHead icon={<IconBox size={16} />} title="Plugins" count={47} sub="Everything on your sources, one at a time" />
    </div>
  )
}

export function Foldable() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="main">
      <SectionHead
        icon={<IconLayers size={16} />} iconClass="col" title="Collections" count={7} sub="Curated sets, installed in one click"
        collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
    </div>
  )
}
