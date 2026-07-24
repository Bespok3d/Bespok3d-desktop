import { useI18n } from '../../../i18n/context'
import { Button } from '../../common/Button'

// The floating bar shown while the store is in a select mode (install or uninstall): how many plugins
// are picked and the one button that acts on the whole set. Cancel leaves select mode; Clear just
// empties the picks. The primary label/action is passed in so one bar serves both modes.
export function SelectActionBar({ count, busy, primaryLabel, onPrimary, onClear, onCancel }: {
  count: number
  busy: boolean
  primaryLabel: string
  onPrimary: () => void
  onClear: () => void
  onCancel: () => void
}) {
  const { t } = useI18n()

  return (
    <div className="select-action-bar">
      <span className="select-count">{t('store.selected_count', { count })}</span>
      <div className="select-actions">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>{t('btn.cancel')}</Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={count === 0 || busy}>{t('store.clear_selection')}</Button>
        <Button variant="primary" size="sm" onClick={onPrimary} disabled={count === 0 || busy}>{primaryLabel}</Button>
      </div>
    </div>
  )
}
