import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import { Button } from '../../../common/Button'
import { IconPlus } from '../../../../design-system/icons'
import { errorMessage } from '../../../../utils/errorMessage'
import type { Repo } from './types'
import './git-host.css'

type AdderMode = 'idle' | 'loading' | 'picking' | 'creating' | 'busy'

function useRepoAdder(onAdd: (repo: Repo) => Promise<void>) {
  const [mode, setMode] = useState<AdderMode>('idle')
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [owners, setOwners] = useState<string[]>([])
  const [owner, setOwner] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)

  async function open() {
    setMode('loading')
    setError(null)
    try {
      const list = await window.b3d.gitHost.listRepos()
      setRepos(list)
      setMode('picking')
    } catch (failure) {
      setError(errorMessage(failure))
      setMode('idle')
    }
  }

  async function pick(pickedOwner: string, pickedRepo: string) {
    setMode('busy')
    try {
      await onAdd({ owner: pickedOwner, repo: pickedRepo })
      setMode('idle')
    } catch (failure) {
      setError(errorMessage(failure))
      setMode('idle')
    }
  }

  // Show the account owner immediately, then append orgs when the host can list them. Both calls reach
  // preload/main code, so each is wrapped best-effort: the picker still works (account-only, or empty)
  // even if either fails, which keeps loadOwners total so its caller needs no error handling.
  async function loadOwners() {
    var self: string[] = []
    try {
      const acc = await window.b3d.gitHost.getAccount()
      self = acc?.login ? [acc.login] : []
    } catch {
      /* no reachable account; org listing below may still populate owners */
    }
    setOwners(self)
    setOwner(self[0] ?? '')
    try {
      const orgs = await window.b3d.gitHost.listOrgs()
      setOwners([...self, ...orgs])
    } catch {
      /* keep account-only; org listing needs the current main/preload build */
    }
  }

  function startCreating() {
    setNewName('')
    setMode('creating')
    void loadOwners()
  }

  async function create() {
    if (!newName.trim()) return
    setMode('busy')
    setError(null)
    try {
      const info = await window.b3d.gitHost.createRepo(newName.trim(), '', isPrivate, owner || undefined)
      await onAdd({ owner: info.owner, repo: info.repo })
      setMode('idle')
    } catch (failure) {
      setError(errorMessage(failure))
      setMode('creating')
    }
  }

  function cancel() {
    setMode('idle')
    setNewName('')
    setError(null)
  }

  return { mode, repos, newName, setNewName, error, open, pick, startCreating, create, cancel, owners, owner, setOwner, isPrivate, setIsPrivate }
}

interface RepoCreateFormProps {
  owners: string[]
  owner: string
  setOwner: (value: string) => void
  isPrivate: boolean
  setIsPrivate: (value: boolean) => void
  newName: string
  setNewName: (value: string) => void
  busy: boolean
  onCreate: () => void
  onCancel: () => void
}

function RepoCreateForm(props: RepoCreateFormProps) {
  const { t } = useI18n()

  return (
    <div className="gh-repo-picker gh-repo-picker-wrap">
      {props.owners.length > 0 && (
        <select className="set-select" value={props.owner} onChange={(event) => props.setOwner(event.target.value)}>
          {props.owners.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      )}
      <input className="set-text" placeholder={t('githost.repos.name_placeholder')} value={props.newName} onChange={(event) => props.setNewName(event.target.value)} autoFocus />
      <label className="gh-private-toggle">
        <input type="checkbox" checked={props.isPrivate} onChange={(event) => props.setIsPrivate(event.target.checked)} /> {t('githost.repos.private')}
      </label>
      <Button variant="primary" size="sm" onClick={props.onCreate} disabled={!props.newName.trim() || props.busy}>
        {props.busy ? t('githost.repos.creating') : t('githost.repos.create')}
      </Button>
      <Button variant="ghost" size="sm" onClick={props.onCancel} disabled={props.busy}>{t('githost.repos.cancel')}</Button>
    </div>
  )
}

export function RepoAdder({ onAdd }: { onAdd: (repo: Repo) => Promise<void> }) {
  const { t } = useI18n()
  const { mode, repos, newName, setNewName, error, open, pick, startCreating, create, cancel, owners, owner, setOwner, isPrivate, setIsPrivate } = useRepoAdder(onAdd)

  if (mode === 'idle' || mode === 'loading') {
    return (
      <div className="gh-adder-bar">
        <Button variant="outline" size="sm" onClick={open} disabled={mode === 'loading'}>
          <IconPlus size={12} /> {mode === 'loading' ? t('githost.repos.loading') : t('githost.repos.add')}
        </Button>
      </div>
    )
  }

  return (
    <div className="gh-adder-stack">
      {mode === 'picking' && (
        <div className="gh-repo-picker">
          <select
            className="set-select"
            defaultValue=""
            onChange={(event) => {
              const picked = event.target.value
              if (!picked) return
              const slash = picked.indexOf('/')
              pick(picked.slice(0, slash), picked.slice(slash + 1))
            }}
          >
            <option value="" disabled>{t('githost.repos.select')}</option>
            {repos.map((repo) => (
              <option key={`${repo.owner}/${repo.repo}`} value={`${repo.owner}/${repo.repo}`}>
                {repo.owner}/{repo.repo}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={startCreating}>{t('githost.repos.new')}</Button>
          <Button variant="ghost" size="sm" onClick={cancel}>{t('githost.repos.cancel')}</Button>
        </div>
      )}
      {(mode === 'creating' || mode === 'busy') && (
        <RepoCreateForm
          owners={owners} owner={owner} setOwner={setOwner}
          isPrivate={isPrivate} setIsPrivate={setIsPrivate}
          newName={newName} setNewName={setNewName}
          busy={mode === 'busy'} onCreate={create} onCancel={cancel}
        />
      )}
      {error && (
        <p className="gh-form-error">{error}</p>
      )}
    </div>
  )
}
