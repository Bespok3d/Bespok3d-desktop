// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TrustTier } from '../../../data/types'
import { useI18n } from '../../../i18n/context'
import cx from '../../../utils/cx'
import { IconShield, IconShieldQ } from '../../../design-system/icons'

interface TrustPillProps {
  trust: TrustTier
  // The shield glyph (cards + the panel head show it; the dense source/repository rows do not).
  icon?: boolean
  // The long-form label ("Bespok3d project") instead of the short tier name ("Project").
  full?: boolean
  title?: string
}

export function TrustPill({ trust, icon, full, title }: TrustPillProps) {
  const { t } = useI18n()
  const ShieldIcon = trust === 'any' || trust === 'unknown' ? IconShieldQ : IconShield
  const label = t(full ? `trust.${trust}.full` : `trust.${trust}`)

  return (
    <span className={cx('trust', trust)} title={title}>
      {icon && <ShieldIcon size={11} />}{label}
    </span>
  )
}
