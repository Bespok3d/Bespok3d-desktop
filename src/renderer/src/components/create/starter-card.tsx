// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import cx from '../../utils/cx'
import { IconChip, IconDownload } from '../../design-system/icons'
import { CREATE_ICONS } from './icon-registry'
import type { MacroStarter } from './create-data'

export function StarterCard({ starter, picked, onPick }: { starter: MacroStarter; picked?: boolean; onPick: () => void }) {
  const Glyph = CREATE_ICONS[starter.icon] ?? IconChip

  return (
    <button className={cx('mk-lib-card', picked && 'picked')} onClick={onPick}>
      <div className="mk-lib-top">
        <span className={'mk-lib-ic ' + starter.accent}><Glyph size={18} /></span>
        <div className="u-min-w-0">
          <div className="mk-lib-name">{starter.title}</div>
          <div className="mk-lib-cat">{starter.category}</div>
        </div>
      </div>
      <p className="mk-lib-blurb">{starter.blurb}</p>
      <div className="mk-lib-foot"><IconDownload size={11} /> {(starter.installs / 1000).toFixed(0)}k printers</div>
    </button>
  )
}
