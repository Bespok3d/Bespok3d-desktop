// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Group } from '../../../common/Group'
import { Markdown } from '../../../common/content/Markdown'
import { useI18n } from '../../../../i18n/context'

// The release notes for the currently-running version. Hidden until the releases list resolves and
// contains the current build.
export function WhatsNewGroup({ releases }: { releases: AppReleaseRow[] | null }) {
  const { t } = useI18n()
  const current = releases?.find((release) => release.isCurrent)
  if (!current) return null

  return (
    <Group title={t('set.update.whats_new', { version: current.version })}>
      <div className="set-row vertical">
        {current.notes
          ? <Markdown source={current.notes} />
          : <div className="set-row-hint">{t('set.update.no_notes')}</div>}
      </div>
    </Group>
  )
}
