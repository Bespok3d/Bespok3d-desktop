// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'
import type { SourceFailure } from '../../../../../main/registry/model'
import { IconAlert } from '../../../design-system/icons'
import type { TFunction } from '../../../i18n'

// A list that failed to load takes its plugins out of the store without a trace, and the other lists
// still fill the grid, so nothing looks wrong. This line names each failed list and what it hides. The
// names come from the last good copy and are text only: none of them can be opened or installed.
export function FailedLists({ failures }: { failures: SourceFailure[] }) {
  const { t } = useI18n()
  if (failures.length === 0) return null

  return (
    <div className="store-failed-lists" role="status">
      {failures.map((failure) => (
        <div key={failure.url} className="store-failed-list">
          <IconAlert size={14} />
          <span>{failureLine(t, failure)}</span>
        </div>
      ))}
    </div>
  )
}

// A saved copy that listed nothing hides nothing, so "It hides:" would trail off into an empty list.
function failureLine(t: TFunction, failure: SourceFailure): string {
  if (!failure.lastListed?.length) return t('store.failed_list.unreachable', { list: failure.name })

  return t('store.failed_list.hides', { list: failure.name, plugins: failure.lastListed.join(', ') })
}
