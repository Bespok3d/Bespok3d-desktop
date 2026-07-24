import type { Printer } from '../../data/types'
import type { TFunction } from '../../i18n'

// The hover reason for a printer's status dot, as an i18n key. Pure so the full status x reach matrix
// is unit-testable without React/i18n. The reason prefers the connection ladder's reach when the daemon
// is down but the printer still answers (a more specific message than the bare status). The dot colour
// itself is the shared `statusDotClass` in the printers data module.
export function statusReasonKey(printer: Printer): string {
  const reach = printer.connection?.reach
  if (printer.status === 'online' && (reach === 'recoverable' || reach === 'alive-no-ssh')) return `status.reach.${reach}`

  return `status.dot.${printer.status}`
}

// A plain-language label for the status dot so the colour is never a mystery: hovering tells the user
// exactly what the app thinks the connection is. The reason is the pure statusReasonKey; only the
// installing override lives here (a header-local concern: a printer mid-install reads as installing).
export function statusLabel(printer: Printer, installing: boolean, t: TFunction): string {
  if (installing) return t('status.installing')

  return t(statusReasonKey(printer))
}
