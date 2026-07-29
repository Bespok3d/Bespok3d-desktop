// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import { IconGitBranch, IconExternalLink } from '../../../design-system/icons'
import { Button } from '../../common/Button'
import { AUTHORING_OPS } from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

export function InstrumentSection({ onOpenSnap }: { onOpenSnap: () => void }) {
  const { t } = useI18n()

  return (
    <div className="wb-sec">
      <SecHead icon="IconGitBranch" title={t('create.sec.instr_title')} tier="nerd"
        blurb={t('create.sec.instr_blurb')} />
      <div className="wb-instr-empty">
        <span className="wb-instr-ic"><IconGitBranch size={22} /></span>
        <div className="wb-instr-text">
          <strong>{t('create.sec.no_patch_title')}</strong>
          <span>{t('create.sec.no_patch_body')}</span>
        </div>
        <Button variant="outline" onClick={onOpenSnap}><IconGitBranch size={14} /> {t('create.sec.author_patch')}</Button>
      </div>
      <div className="wb-instr-demo">
        <div className="wb-instr-demo-head"><span>{t('create.sec.snap_to_place')}</span><OpChip op={AUTHORING_OPS.authorDiff} /></div>
        <div className="wb-instr-diff">
          <div className="wb-diff-line ctx"><span className="ln">142</span><span className="mk"> </span><span>self._notify_data_update_cb = []</span></div>
          <div className="wb-diff-line add"><span className="ln" /><span className="mk">+</span><span>self._card_protocol_parsers = {}</span></div>
          <div className="wb-diff-line ctx"><span className="ln">143</span><span className="mk"> </span><span>self.filament_feed_objects = None</span></div>
        </div>
        <div className="wb-instr-foot">
          <span className="wb-conf-chip"><span className="dot" /> {t('create.sec.match_at')}</span>
          <span className="u-flex-1" />
          <button className="link-btn" onClick={onOpenSnap}>{t('create.sec.open_snap_tool')} <IconExternalLink size={11} /></button>
        </div>
      </div>
    </div>
  )
}
