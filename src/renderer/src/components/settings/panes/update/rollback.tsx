// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { Group } from '../../../common/Group'
import { Button } from '../../../common/Button'
import { Markdown } from '../../../common/content/Markdown'
import { useI18n } from '../../../../i18n/context'
import { mainProcessMessage } from '../../../../utils/errorMessage'
import { updateProblemTextKey } from '../../../../utils/updateProblem'
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
      setState({ busyTag: null, result: null, error: mainProcessMessage(error) })
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

// What the list says when it has nothing to show: why it is empty, and a way to ask again. The retry
// is the whole point of naming the problem, because two of the three (github.com unreachable, github.com
// not answering) are the kind that clear on their own a minute later.
function ReleasesProblem({ problem, onRetry }: { problem: UpdateProblem; onRetry: () => void }) {
  const { t } = useI18n()

  return (
    <div className="set-row">
      <div className="set-row-text"><div className="set-row-hint">{t(updateProblemTextKey(problem))}</div></div>
      <div className="set-row-control">
        <Button variant="ghost" size="sm" onClick={onRetry}>{t('set.update.retry')}</Button>
      </div>
    </div>
  )
}

interface RollbackGroupProps {
  releases: AppReleaseRow[] | null
  releasesProblem: UpdateProblem | null
  onRetryReleases: () => void
  rollback: ReturnType<typeof useRollback>
  onPick: (release: AppReleaseRow) => void
}

// The rollback/version list: feedback line, then every published release as a pick-able row.
export function UpdateRollbackGroup({ releases, releasesProblem, onRetryReleases, rollback, onPick }: RollbackGroupProps) {
  const { t } = useI18n()

  return (
    <Group title={t('set.update.rollback')}>
      <div className="set-row vertical"><div className="set-row-hint">{t('set.update.rollback_hint')}</div></div>
      <RollbackFeedback rollback={rollback} />
      {releasesProblem && <ReleasesProblem problem={releasesProblem} onRetry={onRetryReleases} />}
      {!releasesProblem && releases?.length === 0 && (
        <div className="set-row"><div className="set-row-hint">{t('set.update.no_releases')}</div></div>
      )}
      {releases?.map((release) => (
        <ReleaseRow key={release.tag} release={release} busy={rollback.busyTag === release.tag} onPick={onPick} />
      ))}
    </Group>
  )
}
