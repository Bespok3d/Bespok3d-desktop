// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { Group } from '../../../common/Group'
import { Button } from '../../../common/Button'
import { Markdown } from '../../../common/content/Markdown'
import { useI18n } from '../../../../i18n/context'
import { errorMessage } from '../../../../utils/errorMessage'
import { releaseVerb } from './releases'
import './update.css'

interface RollbackState {
  busyTag: string | null
  result: { version: string; outcome: 'installer' | 'page' } | null
  error: string | null
}

export function useRollback() {
  const [state, setState] = useState<RollbackState>({ busyTag: null, result: null, error: null })
  async function run(target: AppReleaseRow): Promise<void> {
    setState({ busyTag: target.tag, result: null, error: null })
    try {
      const outcome = (await window.b3d.appUpdate.rollback(target.tag)).outcome
      setState({ busyTag: null, result: { version: target.version, outcome }, error: null })
    } catch (error) {
      setState({ busyTag: null, result: null, error: errorMessage(error) })
    }
  }

  return { ...state, run }
}

function RollbackFeedback({ rollback }: { rollback: ReturnType<typeof useRollback> }) {
  const { t } = useI18n()
  if (rollback.error) {
    return <div className="set-row"><div className="set-row-hint error">{rollback.error}</div></div>
  }
  if (!rollback.result) return null
  const key = rollback.result.outcome === 'installer' ? 'set.update.rollback_started' : 'set.update.rollback_page'

  return <div className="set-row"><div className="set-row-hint">{t(key, { version: rollback.result.version })}</div></div>
}

function ReleaseRow({ release, busy, onPick }: { release: AppReleaseRow; busy: boolean; onPick: (release: AppReleaseRow) => void }) {
  const { t } = useI18n()
  const [showNotes, setShowNotes] = useState(false)
  const installedTag = release.isCurrent ? ` · ${t('set.update.installed')}` : ''
  const verb = releaseVerb(release)

  return (
    <div className="set-row vertical">
      <div className="release-row-head">
        <div className="set-row-text">
          <div className="set-row-label mono">{release.version}{installedTag}</div>
          {release.publishedAt && <div className="set-row-hint">{new Date(release.publishedAt).toLocaleDateString()}</div>}
        </div>
        <div className="set-row-control">
          <Button variant="ghost" size="sm" onClick={() => setShowNotes((prev) => !prev)}>
            {showNotes ? t('set.update.hide_changelog') : t('set.update.changelog')}
          </Button>
          {!release.isCurrent && (
            <Button size="sm" disabled={busy} onClick={() => onPick(release)}>
              {busy ? t(`set.update.${verb}ing`) : t(`set.update.${verb}`)}
            </Button>
          )}
        </div>
      </div>
      {showNotes && (
        <div className="release-row-notes">
          {release.notes
            ? <Markdown source={release.notes} />
            : <div className="set-row-hint">{t('set.update.no_notes')}</div>}
        </div>
      )}
    </div>
  )
}

// The rollback/version list: feedback line, then every published release as a pick-able row.
export function UpdateRollbackGroup({ releases, releasesError, rollback, onPick }: { releases: AppReleaseRow[] | null; releasesError: string | null; rollback: ReturnType<typeof useRollback>; onPick: (release: AppReleaseRow) => void }) {
  const { t } = useI18n()

  return (
    <Group title={t('set.update.rollback')}>
      <div className="set-row vertical"><div className="set-row-hint">{t('set.update.rollback_hint')}</div></div>
      <RollbackFeedback rollback={rollback} />
      {releasesError && <div className="set-row"><div className="set-row-hint error">{releasesError}</div></div>}
      {releases && releases.length === 0 && <div className="set-row"><div className="set-row-hint">{t('set.update.no_releases')}</div></div>}
      {releases?.map((release) => (
        <ReleaseRow key={release.tag} release={release} busy={rollback.busyTag === release.tag} onPick={onPick} />
      ))}
    </Group>
  )
}
