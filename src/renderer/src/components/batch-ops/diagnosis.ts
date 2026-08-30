// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TFunction } from '../../i18n'

// The user-facing text for a machine diagnosis the printer emitted about a batch: the reason a safety
// net fixer gives for a plugin it disabled, and the kind of unreadable the printer found in a plugin it
// could not account for. Both are TOKENS the daemon and jinni emit for the client to localize
// (ADR-0037); other fixers still carry a daemon-authored reason string. A known token is localized;
// anything else (a prose reason, or a newer daemon's unknown token) forward-degrades to itself, so
// what the printer said is never blank and is never dropped for being newer than this app.
export function diagnosisText(t: TFunction, diagnosis: string): string {
  if (diagnosis === 'broker-down') return t('diagnosis.broker_down')
  if (diagnosis === 'manifest-unreadable') return t('diagnosis.manifest_unreadable')

  return diagnosis
}
