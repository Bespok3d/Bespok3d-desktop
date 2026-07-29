// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { IconInfo } from '../../../design-system/icons'
import { useI18n } from '../../../i18n/context'
import './discovery-cloud-hint.css'

export function DiscoveryCloudHint() {
  const { t } = useI18n()

  return (
    <div className="discovery-cloud-hint">
      <IconInfo size={13} />
      <span>{t('discovery.cloud_hint')}</span>
    </div>
  )
}
