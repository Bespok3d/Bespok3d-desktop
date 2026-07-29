// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReleaseChannel } from '../../../data/types'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'

interface ChannelPillProps {
  channel: ReleaseChannel
  // Marks the channel the printer's copy came from (provenance) with the installed-chan accent.
  installed?: boolean
  title?: string
}

export function ChannelPill({ channel, installed, title }: ChannelPillProps) {
  const { t } = useI18n()

  return (
    <span className={cx('chan-pill compact', installed && 'installed-chan')} data-tone={channel} title={title}>
      {t(`chan.${channel}`)}
    </span>
  )
}
