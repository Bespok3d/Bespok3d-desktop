// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../../i18n/context'
import { InstallLogShell } from './shell'
import { InstallLogView } from './view'

// The structured report in a dismissable modal, opened from the history list and the install zone.
export function InstallLogModal({ log, pluginName, onClose }: {
  log: InstallLog; pluginName: string; onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <InstallLogShell title={t('install.log.title')} pluginName={pluginName} onClose={onClose}>
      <InstallLogView log={log} />
    </InstallLogShell>
  )
}
