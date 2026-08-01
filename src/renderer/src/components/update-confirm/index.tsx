// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin, PluginSource } from '../../data/types'
import type { InstalledOnPrinter } from '../../data/channels/updates'
import { useI18n } from '../../i18n/context'
import { Button } from '../common/Button'
import { ConfirmActionDialog } from '../common/overlay/ConfirmActionDialog'
import { SourcesSection, sourceKey } from '../plugin-store/panel/tabs/sources'
import type { UpdateConfirmRow } from './rows'
import { updateConfirmRows, specsWithPickedSource } from './rows'
import './update-confirm.css'

// What the update is about to do, before it does it: one line per plugin with the two versions and
// where the new build comes from, and, folded away under each line, every other place that offers the
// same plugin, so the user can send a different build instead of the one that was offered.
export function UpdateConfirmDialog({ specs, plugins, installed, onConfirm, onCancel }: {
  specs: PluginUpdateSpec[]
  plugins: Plugin[]
  installed: InstalledOnPrinter
  onConfirm: (specs: PluginUpdateSpec[]) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [picked, setPicked] = useState<PluginUpdateSpec[]>(specs)
  const [openFor, setOpenFor] = useState<string | undefined>(undefined)
  const rows = updateConfirmRows(picked, plugins, installed)

  function pickSource(pluginId: string, sources: PluginSource[], key: string) {
    const source = sources.find((candidate) => sourceKey(candidate) === key)
    if (source) setPicked((prev) => specsWithPickedSource(prev, pluginId, source))
  }

  function otherVersionsFor(row: UpdateConfirmRow) {
    return (
      <SourcesSection
        sources={row.otherSources}
        selected={row.source ? sourceKey(row.source) : undefined}
        installedSource={installed.sources?.[row.pluginId]}
        installedVersion={installed.versions[row.pluginId]}
        onSelect={(key) => pickSource(row.pluginId, row.otherSources, key)}
        t={t}
      />
    )
  }

  function rowFor(row: UpdateConfirmRow) {
    const open = openFor === row.pluginId

    return (
      <li key={row.pluginId} className="update-confirm-row">
        <div className="update-confirm-line">
          <span className="update-confirm-name">{row.name}</span>
          <span className="card-version">{t('store.update_confirm.versions', { from: row.fromVersion, to: row.toVersion })}</span>
          {row.source?.local && <span className="local-badge">{t('store.local_source')}</span>}
          <Button variant="ghost" size="sm" onClick={() => setOpenFor(open ? undefined : row.pluginId)}>
            {t('store.update_confirm.other_versions')}
          </Button>
        </div>
        {row.movedSource && <p className="update-confirm-moved">{t('store.update_confirm.moved_source')}</p>}
        {open && otherVersionsFor(row)}
      </li>
    )
  }

  return (
    <ConfirmActionDialog
      title={t('store.update_confirm.title')}
      summary={t('store.update_confirm.summary', { count: String(rows.length) })}
      detail={t('store.update_confirm.detail')}
      confirmLabel={t('store.update_confirm.confirm')}
      extra={<ul className="update-confirm-list">{rows.map(rowFor)}</ul>}
      onConfirm={() => onConfirm(picked)}
      onCancel={onCancel}
    />
  )
}
