// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import { IconSliders, IconScreen } from '../../../design-system/icons'
import { Toggle } from '../../common/Toggle'
import {
  VAR_TYPES, DRAFT_VARIABLES, AUTHORING_OPS, type DraftVariable,
} from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

function VarRow({ variable }: { variable: DraftVariable }) {
  const { t } = useI18n()
  const typeLabel = VAR_TYPES.find((varType) => varType.id === variable.type)?.label

  return (
    <div className="wb-var-row">
      <div className="wb-var-grip"><IconSliders size={14} /></div>
      <div className="wb-var-main">
        <div className="wb-var-line1">
          <span className="wb-var-label">{variable.label}</span>
          <span className="mk-tun-key">{variable.key}</span>
          <span className={'wb-type-pill ' + variable.type}>{typeLabel}</span>
          {variable.required && <span className="wb-req">{t('create.sec.required')}</span>}
        </div>
        <div className="wb-var-hint">{variable.hint}</div>
      </div>
      <div className="wb-var-default">
        <span className="lbl">{t('create.sec.default')}</span>
        <span className="val mono">{String(variable.default)}</span>
      </div>
    </div>
  )
}

function ConsumerField({ variable }: { variable: DraftVariable }) {
  return (
    <div className="wb-cons-field">
      <label>{variable.label}{variable.required && <span className="req-star">*</span>}</label>
      {variable.type === 'toggle'
        ? <Toggle on={variable.default === true} disabled onChange={() => {}} />
        : <span className="val mono">{String(variable.default)}</span>}
    </div>
  )
}

export function VariablesSection() {
  const { t } = useI18n()

  return (
    <div className="wb-sec">
      <SecHead icon="IconSliders" title={t('create.sec.variables_title')} tier="tinkerer"
        blurb={t('create.sec.variables_blurb')} />
      <div className="wb-var-list">{DRAFT_VARIABLES.map((variable) => <VarRow key={variable.key} variable={variable} />)}</div>
      <div className="wb-preview">
        <div className="wb-preview-head"><IconScreen size={13} /> {t('create.sec.installer_sees')}</div>
        <div className="wb-preview-body">{DRAFT_VARIABLES.map((variable) => <ConsumerField key={variable.key} variable={variable} />)}</div>
      </div>
      <OpChip op={AUTHORING_OPS.declareVariable} />
    </div>
  )
}
