import type { Printer } from '../../../data/types'
import { useI18n } from '../../../i18n/context'
import {
  IconCheck, IconUpload, IconDownload, IconAlert,
} from '../../../design-system/icons'
import {
  DRAFT_PROVIDES, DRAFT_REQUIRES, AUTHORING_OPS, type RequiredService,
} from '../create-data'
import { OpChip } from './op-chip'
import { SecHead } from './sec-head'

function RequireRow({ requirement, printer }: { requirement: RequiredService; printer: Printer }) {
  const { t } = useI18n()
  const installedHere = printer.installedIds.some((id) => id.includes(requirement.service))
  const missText = requirement.optional ? t('create.sec.req_miss_opt', { printer: printer.nick, service: requirement.service }) : t('create.sec.req_miss', { printer: printer.nick, service: requirement.service })

  return (
    <div className="wb-svc-row">
      <span className="wb-svc-ic"><IconDownload size={14} /></span>
      <span className="wb-svc-name mono">{requirement.service}</span>
      <span className="wb-svc-selector mono">{requirement.selector} · {requirement.cardinality}</span>
      {requirement.optional && <span className="wb-opt">{t('create.sec.optional')}</span>}
      <span className="wb-svc-grow" />
      <span className={'wb-svc-resolve ' + (installedHere ? 'ok' : 'miss')}>
        {installedHere
          ? <><IconCheck size={12} /> {t('create.sec.req_has', { printer: printer.nick, resolved: requirement.resolvedBy })}</>
          : <><IconAlert size={12} /> {missText}</>}
      </span>
    </div>
  )
}

export function ServicesSection({ printer }: { printer: Printer }) {
  const { t } = useI18n()

  return (
    <div className="wb-sec">
      <SecHead icon="IconLink" title={t('create.sec.services_title')} tier="tinkerer"
        blurb={t('create.sec.services_blurb')} />
      <div className="wb-svc-group">
        <div className="wb-svc-label">{t('create.sec.provides')}</div>
        {DRAFT_PROVIDES.map((provided) => (
          <div className="wb-svc-row provide" key={provided.service}>
            <span className="wb-svc-ic"><IconUpload size={14} /></span>
            <span className="wb-svc-name mono">{provided.service}</span>
            <span className="wb-svc-desc">{t('create.sec.capability_desc')}</span>
            {provided.exclusive && <span className="wb-req">{t('create.sec.exclusive')}</span>}
          </div>
        ))}
      </div>
      <div className="wb-svc-group">
        <div className="wb-svc-label">{t('create.sec.requires')}</div>
        {DRAFT_REQUIRES.map((requirement) => <RequireRow key={requirement.service} requirement={requirement} printer={printer} />)}
      </div>
      <OpChip op={AUTHORING_OPS.declareService} />
    </div>
  )
}
