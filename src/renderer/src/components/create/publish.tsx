import type { Printer } from '../../data/types'
import { IconLock, IconSpool, IconKey, IconCheckCircle, IconShieldCheck, IconAlert } from '../../design-system/icons'
import { Button } from '../common/Button'
import { useI18n } from '../../i18n/context'
import { WORKBENCH_DRAFTS, DEMO_GITHUB_ACCOUNT, DEMO_SIGNING_KEY, AUTHORING_OPS } from './create-data'

export function PublishSurface({ printer }: { printer: Printer }) {
  const { t } = useI18n()
  const draft = WORKBENCH_DRAFTS[0]
  const account = DEMO_GITHUB_ACCOUNT
  const key = DEMO_SIGNING_KEY
  const identity = `${account.login}@github/${draft.name}`

  return (
    <div className="create-pane">
      <div className="cp-head">
        <div className="cp-eyebrow"><span className="stage-dot">3</span> {t('create.pub.eyebrow')}</div>
        <h1 className="cp-title">{t('create.pub.title')}</h1>
        <p className="cp-sub">{t('create.pub.sub')}</p>
      </div>

      <div className="pub-gate">
        <span className="pub-gate-ic"><IconLock size={18} /></span>
        <div className="pub-gate-text">
          <strong>{t('create.pub.gate_title')}</strong>
          <span>{t('create.pub.gate_body')}</span>
        </div>
        <span className="pub-gate-flag">PUBLISHING_ENABLED = false</span>
      </div>

      <div className="pub-flow">
        <div className="pub-step">
          <div className="pub-step-num">1</div>
          <div className="pub-step-body">
            <div className="pub-step-title">{t('create.pub.step1_title')}</div>
            <div className="pub-step-sub">{t('create.pub.step1_sub')}</div>
            <div className="pub-build-row">
              <span className="card-icon fil pub-build-icon"><IconSpool /></span>
              <div className="pub-build-text"><strong>{draft.title}</strong><span className="mono">{draft.name}-{draft.version}.b3 · {draft.sizeKB} KB</span></div>
              <span className="wb-build-pill ok"><IconCheckCircle size={12} /> {t('create.pub.tested_on', { printer: printer.nick })}</span>
            </div>
          </div>
        </div>

        <div className="pub-step">
          <div className="pub-step-num">2</div>
          <div className="pub-step-body">
            <div className="pub-step-title">{t('create.pub.step2_title')}</div>
            <div className="pub-step-sub">{t('create.pub.step2_sub')}</div>
            <div className="pub-key-row inactive">
              <span className="key-icon pub-key-icon" data-kind="package"><IconKey size={15} /></span>
              <div className="pub-key-text">
                <strong>{key.label}</strong>
                <span className="mono">{key.type} · {key.fingerprintShort}</span>
              </div>
              {key.publishedTo
                ? <span className="wb-build-pill ok"><IconShieldCheck size={12} /> {t('create.pub.key_published')}</span>
                : <span className="wb-build-pill warn"><IconAlert size={12} /> {t('create.pub.key_publish_first')}</span>}
            </div>
            <div className="op-chip u-mt-2">{AUTHORING_OPS.sign}</div>
          </div>
        </div>

        <div className="pub-step">
          <div className="pub-step-num">3</div>
          <div className="pub-step-body">
            <div className="pub-step-title">{t('create.pub.step3_title')}</div>
            <div className="pub-step-sub">{t('create.pub.step3_sub')}</div>
            <div className="pub-dest">
              <div className="pub-dest-row"><span className="lbl">{t('create.pub.identity')}</span><span className="val mono">{identity}</span></div>
              <div className="pub-dest-row"><span className="lbl">{t('create.pub.deep_link')}</span><span className="val mono">b3d://{account.login}@github/{draft.name}</span></div>
              <div className="pub-dest-row"><span className="lbl">{t('create.pub.release_to')}</span><span className="val mono">{account.publishRepo}</span></div>
            </div>
            <div className="op-chip u-mt-2">{AUTHORING_OPS.publish}</div>
          </div>
        </div>
      </div>

      <div className="pub-cta">
        <Button variant="primary" size="lg" disabled><IconLock size={15} /> {t('create.pub.sign_publish')}</Button>
        <span className="pub-cta-note">{t('create.pub.cta_note_pre')} <strong>{t('create.pub.cta_note_settings')}</strong> {t('create.pub.cta_note_post')}</span>
      </div>
    </div>
  )
}
