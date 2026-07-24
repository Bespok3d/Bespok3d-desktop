import { useI18n } from '../../../i18n/context'
import { IconShield, IconScreen, IconSpool } from '../../../design-system/icons'
import { AUTHORING_OPS, type WorkbenchDraft } from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

export function MetadataSection({ draft }: { draft: WorkbenchDraft }) {
  const { t } = useI18n()
  const description = t('create.sec.sample_desc')

  return (
    <div className="wb-sec">
      <SecHead icon="IconLayers" title={t('create.sec.listing_title')} tier="tinkerer"
        blurb={t('create.sec.listing_blurb')} />
      <div className="wb-meta-split">
        <div className="wb-meta-form">
          <div className="wb-meta-field"><label>{t('create.sec.field_title')}</label><span className="val">{draft.title}</span></div>
          <div className="wb-meta-field"><label>{t('create.sec.field_tagline')}</label><span className="val">{draft.tagline}</span></div>
          <div className="wb-meta-field"><label>{t('create.sec.field_category')}</label><span className="val">{draft.category}</span></div>
          <div className="wb-meta-field"><label>{t('create.sec.field_description')}</label><span className="val">{description}</span></div>
        </div>
        <div className="wb-meta-preview">
          <div className="wb-preview-head"><IconScreen size={13} /> {t('create.sec.store_card')}</div>
          <div className="card wb-card-preview">
            <div className="card-top">
              <div className="card-icon fil"><IconSpool /></div>
              <div className="card-heading">
                <div className="card-title">{draft.title}</div>
                <div className="card-publisher"><span className="trust community"><IconShield size={11} /> {t('create.sec.you')}</span><span className="card-version">v{draft.version}</span></div>
              </div>
            </div>
            <p className="card-desc">{draft.tagline}</p>
          </div>
          <div className="wb-detail-prev">
            <div className="wb-detail-tabs"><span className="active">{t('create.sec.tab_overview')}</span><span>{t('create.sec.tab_doc')}</span><span>{t('create.sec.tab_changelog')}</span></div>
            <p>{description}</p>
          </div>
        </div>
      </div>
      <OpChip op={AUTHORING_OPS.setField} />
    </div>
  )
}
