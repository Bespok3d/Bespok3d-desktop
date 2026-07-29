// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useRef } from 'react'
import { useClickOutside } from '../../../common/hooks/useClickOutside'
import { useI18n } from '../../../../i18n/context'
import type { TFunction } from '../../../../i18n'
import type { KeyRecord, KeyAssignment, KeyPurpose } from '../../../../data/keyTypes'
import type { Printer } from '../../../../data/types'

const ANY_ENTITY_ID = '*'
const ANY_ENTITY = { id: ANY_ENTITY_ID, label: ANY_ENTITY_ID }

function chipTitle(isDisabled: boolean, isImplicitDefault: boolean, t: TFunction): string | undefined {
  if (isDisabled) return t('keys.purpose.no_repos')
  if (isImplicitDefault) return t('keys.purpose.default_tip')

  return undefined
}

function repoEntity(repo: { owner: string; repo: string }): { id: string; label: string } {
  const id = `${repo.owner}/${repo.repo}`

  return { id, label: id }
}

function uniqueRepos(
  repos: { owner: string; repo: string }[]
): { owner: string; repo: string }[] {
  const seen = new Set<string>()

  return repos.filter((repo) => {
    const key = `${repo.owner}/${repo.repo}`
    if (seen.has(key)) return false
    seen.add(key)

    return true
  })
}

function entitiesForPurpose(
  purpose: KeyPurpose,
  printers: Printer[],
  gitHostSettings: GitHostSettings | null,
  allUserRepos: { owner: string; repo: string }[]
): Array<{ id: string; label: string }> {
  if (purpose === 'printers')
    return printers.map((printer) => ({ id: printer.id, label: printer.nick }))
  if (purpose === 'packages')
    return [ANY_ENTITY, ...(gitHostSettings?.pluginRepos ?? []).map(repoEntity)]
  if (purpose === 'lists')
    return [ANY_ENTITY, ...(gitHostSettings?.listRepos ?? []).map(repoEntity)]
  if (purpose === 'contribution') {
    const combined = uniqueRepos([
      ...(gitHostSettings?.pluginRepos ?? []),
      ...(gitHostSettings?.listRepos ?? []),
      ...allUserRepos,
    ])

    return [ANY_ENTITY, ...combined.map(repoEntity)]
  }

  return []
}

function assignmentForPurpose(key: KeyRecord, purpose: KeyPurpose): KeyAssignment | null {
  return key.assignments.find((assignment) => assignment.purpose === purpose) ?? null
}

interface PurposeChipProps {
  purposeDef: { id: KeyPurpose; labelKey: string }
  keyRecord: KeyRecord
  printers: Printer[]
  gitHostSettings: GitHostSettings | null
  allUserRepos: { owner: string; repo: string }[]
  onSetAssignments: (key: KeyRecord, assignments: KeyAssignment[]) => Promise<void>
}

export function PurposeChip({ purposeDef, keyRecord, printers, gitHostSettings, allUserRepos, onSetAssignments }: PurposeChipProps) {
  const { t } = useI18n()
  const [dropOpen, setDropOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(wrapRef, () => setDropOpen(false), dropOpen)

  const entities = entitiesForPurpose(purposeDef.id, printers, gitHostSettings, allUserRepos)
  const assignment = assignmentForPurpose(keyRecord, purposeDef.id)
  const isActive = assignment !== null
  const isDisabled = entities.length === 0
  const isImplicitDefault = keyRecord.isDefault && !isActive && !isDisabled

  function entityText(entity: { id: string; label: string }): string {
    return entity.id === ANY_ENTITY_ID ? t('keys.purpose.any_repo') : entity.label
  }

  function activeEntityLabel(): string | null {
    if (!assignment) return null
    const match = entities.find((entity) => entity.id === assignment.entityId)

    return match ? entityText(match) : assignment.entityId
  }

  const entityLabel = activeEntityLabel()

  function removeAssignment() {
    onSetAssignments(keyRecord, keyRecord.assignments.filter((asgn) => asgn.purpose !== purposeDef.id))
    setDropOpen(false)
  }

  function handleChipClick() {
    if (entities.length === 0) return
    if (entities.length === 1) {
      if (assignment) {
        removeAssignment()
      } else {
        onSetAssignments(keyRecord, [
          ...keyRecord.assignments,
          { purpose: purposeDef.id, entityId: entities[0].id },
        ])
      }

      return
    }
    setDropOpen(true)
  }

  function finishAssignment(entityId: string) {
    const next = [
      ...keyRecord.assignments.filter((asgn) => asgn.purpose !== purposeDef.id),
      { purpose: purposeDef.id, entityId },
    ]
    onSetAssignments(keyRecord, next)
    setDropOpen(false)
  }

  return (
    <div ref={wrapRef} className="u-relative u-inline-flex">
      <button
        className={`purpose-chip${isActive ? ' active' : ''}${isImplicitDefault ? ' implicit-default' : ''}`}
        disabled={isDisabled}
        title={chipTitle(isDisabled, isImplicitDefault, t)}
        onClick={handleChipClick}
      >
        {t(purposeDef.labelKey)}
        {entityLabel && <span className="chip-entity">· {entityLabel}</span>}
        {isImplicitDefault && <span className="chip-entity chip-default-label">· {t('keys.purpose.default_label')}</span>}
        {entities.length > 1 && <span className="chip-arrow">▾</span>}
      </button>
      {dropOpen && (
        <div className="chip-dropdown">
          {entities.map((entity) => (
            <button
              key={entity.id}
              className={`chip-dropdown-item${assignment?.entityId === entity.id ? ' current' : ''}`}
              onClick={() => finishAssignment(entity.id)}
            >
              {entityText(entity)}
            </button>
          ))}
          {isActive && (
            <button className="chip-dropdown-item chip-dropdown-remove" onClick={removeAssignment}>
              {t('keys.purpose.unassign')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
