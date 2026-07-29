// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import {
  IconFolder, IconLayers, IconCode, IconChevron, IconCheck, IconInfo,
} from '../../../design-system/icons'
import {
  DEST_CLASSES, DRAFT_FILES, AUTHORING_OPS, type DraftFile,
} from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

function classLabel(id: string): string {
  return DEST_CLASSES.find((destClass) => destClass.id === id)?.label ?? id
}

function FileRow({ file }: { file: DraftFile }) {
  const { t } = useI18n()
  const lowConfidence = file.conf < 0.8 && !file.doc

  return (
    <div className={'wb-file-row' + (file.doc ? ' doc' : '')}>
      <div className="wb-file-name">
        <IconCode size={13} /> <span className="mono">{file.name}</span>
        {lowConfidence && <span className="wb-file-flag" title={t('create.sec.low_conf')}>{t('create.sec.check')}</span>}
      </div>
      {file.doc ? (
        <div className="wb-file-class doc"><IconLayers size={12} /> {t('create.sec.shown_in_store')}</div>
      ) : (
        <div className="wb-class-pick" aria-disabled>
          <span className="wb-class-dot" data-c={file.cls} />
          {classLabel(file.cls)}
          <IconChevron size={13} />
        </div>
      )}
      <div className="wb-file-act">{!file.doc && <OpChip op={AUTHORING_OPS.classify} subtle />}</div>
    </div>
  )
}

export function FilesSection() {
  const { t } = useI18n()
  const placed = DRAFT_FILES.filter((file) => !file.doc).length

  return (
    <div className="wb-sec">
      <SecHead icon="IconFolder" title={t('create.sec.files_title')} tier="tinkerer"
        blurb={t('create.sec.files_blurb')} />
      <div className="wb-drop filled">
        <span className="wb-drop-ic"><IconFolder size={20} /></span>
        <div className="wb-drop-text">
          <strong>spool-color-detect/</strong>
          <span className="mono">{t('create.sec.imported_meta')}</span>
        </div>
        <OpChip op={AUTHORING_OPS.importFiles} />
      </div>
      <div className="wb-file-list">
        <div className="wb-file-head"><span>{t('create.sec.col_file')}</span><span>{t('create.sec.col_classified')}</span><span /></div>
        {DRAFT_FILES.map((file) => <FileRow key={file.name} file={file} />)}
      </div>
      <div className="wb-grow-note">
        <IconInfo size={13} />
        <span>{t('create.sec.classes_grow')}</span>
      </div>
      <div className="wb-sec-stat"><IconCheck size={13} className="ok" /> {t('create.sec.files_placed', { placed })}</div>
    </div>
  )
}
