import { useI18n } from '../../i18n/context'
import { Explainer } from '../common/content/Explainer'
import './JinniCaution.css'

// Three levels: a one-line caution, the brief reason, and the full list on demand (Explainer).
export function JinniCaution({ extras }: { extras: string[] }) {
  const { t } = useI18n()
  if (extras.length === 0) return null

  return (
    <div className="jinni-caution">
      <Explainer
        brief={t('jinni.caution.brief')}
        detail={t('jinni.caution.detail', { count: extras.length, extras: extras.join(', ') })}
      />
    </div>
  )
}
