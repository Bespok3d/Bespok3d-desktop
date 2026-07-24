import type { TFunction } from '../../../i18n'

// The user-facing name of a blocked-action token (ADR-0037: the daemon and jinni emit machine
// tokens, the client localizes them). Klipper and Moonraker are product names, never translated;
// the display is described via i18n. An unknown token forward-degrades to itself so a newer daemon
// never shows a blank reason.
function blockedActionLabel(t: TFunction, token: string): string {
  if (token === 'restart-klipper') return 'Klipper'
  if (token === 'restart-moonraker') return 'Moonraker'
  if (token === 'restart-display') return t('store.blocked_action.display')

  return token
}

// A comma-joined, localized list of the services a set of blocked-action tokens would restart, for
// the "why is this locked" surface.
export function blockedActionsSummary(t: TFunction, tokens: string[]): string {
  return tokens.map((token) => blockedActionLabel(t, token)).join(', ')
}
