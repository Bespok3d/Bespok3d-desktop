// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Button } from '../../common/Button'
import type { TFunction } from '../../../i18n'
import { IconGitBranch, IconGitHub } from '../../../design-system/icons'
import { TrustPill } from '../../common/badges/TrustPill'
import { Toggle } from '../../common/Toggle'
import type { SourceRow } from '../../../data/types'
import { isMissingOfficialDevIndex, signInWouldReach } from '../../../data/source-failure'
import cx from '../../../utils/cx'

interface SourceItemProps {
  source: SourceRow
  gitHubConnected: boolean
  t: TFunction
  onToggle: (enabled: boolean) => void
  onConnectGitHub: () => void
}

function sourceMeta(source: SourceRow, t: TFunction): string {
  if (isMissingOfficialDevIndex(source)) return t('repos.dev_index_not_published')
  if (source.status === 'failed') return source.error ?? t('repos.unreachable')
  if (source.status === 'disabled') return t('repos.off')

  return `${source.pluginCount} ${t('repos.plugins')}`
}

export function RepositorySourceRow({ source, gitHubConnected, t, onToggle, onConnectGitHub }: SourceItemProps) {
  const needsAuth = signInWouldReach(source, gitHubConnected)

  return (
    <div className={cx('set-row repo-row', !source.enabled && 'disabled', source.status === 'failed' && 'failed')}>
      <div className="repo-icon"><IconGitBranch size={15} /></div>
      <div className="set-row-text">
        <div className="set-row-label">
          {source.name}
          {source.status === 'ok' && <TrustPill trust={source.trust} />}
        </div>
        <div className="repo-meta">
          <span>{sourceMeta(source, t)}</span>
          {source.locked && <span className="mono dim">{t('repos.locked')}</span>}
        </div>
      </div>
      <div className="set-row-control">
        {needsAuth && (
          <Button variant="primary" size="sm" onClick={onConnectGitHub}>
            <IconGitHub size={13} /> {t('repos.sign_in')}
          </Button>
        )}
        <Toggle on={source.enabled} onChange={onToggle} />
      </div>
    </div>
  )
}
