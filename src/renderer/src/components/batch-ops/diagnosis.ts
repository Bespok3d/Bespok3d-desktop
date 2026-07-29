// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../../i18n'

// The user-facing text for a recovery reason. The safety net's device-infrastructure fixer relays a
// machine diagnosis TOKEN the jinni emitted (ADR-0037: the daemon and jinni emit tokens, the client
// localizes them); other fixers still carry a daemon-authored reason string. A known token is
// localized; anything else (a prose reason, or a newer daemon's unknown token) forward-degrades to
// itself, so a recovery reason is never blank.
export function diagnosisText(t: TFunction, reason: string): string {
  if (reason === 'broker-down') return t('diagnosis.broker_down')

  return reason
}
