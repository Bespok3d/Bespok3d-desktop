// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import type { Plugin } from '../../../data/types'
import type { PluginVarsSave } from '../../../data/plugin-vars'
import type { Collection, CollectionMember } from '../../../data/collections'
import { collectionMembers, splitMembers, pluginBecameCollection } from '../../../data/collections'
import type { PluginMigration } from '../migrations'
import type { TFunction } from '../../../i18n'
import { useI18n } from '../../../i18n/context'
import type { B3dEntityRef } from '../../../data/b3d-ref'
import { Modal } from '../../common/overlay/Modal'
import { Markdown } from '../../common/content/Markdown'
import { docAssetsFor } from '../../../data/catalog/shape'
import { Button } from '../../common/Button'
import { TrustPill } from '../../common/badges/TrustPill'
import { StatusPill } from '../../common/badges/StatusPill'
import { ChannelPill } from '../../common/badges/ChannelPill'
import { IconChevron, IconClose, IconDownload, IconLayers } from '../../../design-system/icons'
import { BatchConfigModal } from '../select/BatchConfigModal'
import { useCollectionInstall } from '../select/useCollectionInstall'
import { splitByBatchGate, batchBlockReason } from '../batch-gate'
import type { InstallBlock } from '../panel/install-gate'

function CollectionHead({ collection, fullyInstalled, t }: { collection: Collection; fullyInstalled: boolean; t: TFunction }) {
  return (
    <div className="panel-head">
      <div className="panel-hero">
        <div className="card-icon col"><IconLayers size={30} /></div>
        <div className="panel-titles">
          <h1>{collection.title}</h1>
          <div className="sub"><code>{collection.name}</code><span>·</span><span>v{collection.version}</span></div>
        </div>
      </div>
      <div className="panel-stat-row">
        <TrustPill trust={collection.trust} icon full title={t(`trust.${collection.trust}.full`)} />
        {collection.channel !== 'stable' && <ChannelPill channel={collection.channel} />}
        {fullyInstalled && <StatusPill status="installed" />}
      </div>
    </div>
  )
}

// One member row: reuses the `.dep-row` shape but is a button so the user can open that plugin's own
// detail (stacked over the collection) and check it out before committing to the full install. An
// already-installed member is marked with the same StatusPill the store cards use; the trailing chevron
// signals the row drills into the plugin's page.
function MemberStatus({ installed, block, t }: { installed: boolean; block: InstallBlock | null; t: TFunction }) {
  if (installed) return <StatusPill status="installed" />
  if (block) return <span className="collection-member-add" title={block.detail}>{block.brief}</span>

  return <span className="collection-member-add">{t('collection.member_will_install')}</span>
}

function MemberRow({ member, installed, block, onOpen, t }: { member: Plugin; installed: boolean; block: InstallBlock | null; onOpen: () => void; t: TFunction }) {
  return (
    <button type="button" className="dep-row collection-member" onClick={onOpen} title={t('collection.member_view')}>
      <span className="name">{member.title}</span>
      <MemberStatus installed={installed} block={block} t={t} />
      <IconChevron className="collection-member-go" size={14} />
    </button>
  )
}

// `installableCount` is what "Install all" will really install: the missing members that pass the same
// gate a single install passes. A member the plugin panel would refuse right now is not counted here
// and says why on its own row, so the button never promises an install the daemon would reject.
function CollectionFoot({ installableCount, fullyInstalled, hasPrinter, installing, block, onInstallAll, onClose, t }: {
  installableCount: number; fullyInstalled: boolean; hasPrinter: boolean; installing: boolean; block: InstallBlock | null
  onInstallAll: () => void; onClose: () => void; t: TFunction
}) {
  return (
    <div className="panel-foot">
      {fullyInstalled && <span className="panel-foot-note">{t('collection.all_installed')}</span>}
      {!fullyInstalled && !hasPrinter && <span className="panel-foot-note">{t('collection.needs_printer')}</span>}
      {!fullyInstalled && hasPrinter && block && <span className="panel-foot-note">{block.brief}</span>}
      <Button variant="outline" onClick={onClose}>{t('btn.close')}</Button>
      {!fullyInstalled && (
        <Button variant="primary" disabled={!hasPrinter || installableCount === 0 || installing} title={block?.detail} onClick={onInstallAll}>
          <IconDownload size={14} />
          {t('collection.install_all', { count: installableCount })}
        </Button>
      )}
    </div>
  )
}

// While the collection's id is still installed as the retired plugin, the foot offers the migration
// instead of "Install all": one run that takes the old plugin off and puts the members on. A member
// the gate refuses would take the old plugin's features off the printer without putting that member's
// back, so any blocked member disables the whole migration. Once the old plugin is gone, only the
// plain-terms explanation of what happened remains.
function MigrationFoot({ migrated, hasPrinter, installing, blockedCount, block, onMigrate, onClose, t }: {
  migrated: boolean; hasPrinter: boolean; installing: boolean; blockedCount: number; block: InstallBlock | null
  onMigrate: () => void; onClose: () => void; t: TFunction
}) {
  return (
    <div className="panel-foot">
      <span className="panel-foot-note">{t(migrated ? 'collection.migrated_note' : 'collection.migrate_explain')}</span>
      <Button variant="outline" onClick={onClose}>{t('btn.close')}</Button>
      {!migrated && (
        <Button variant="primary" disabled={!hasPrinter || installing || blockedCount > 0 || !!block} title={block?.detail} onClick={onMigrate}>
          <IconDownload size={14} />
          {t('collection.migrate_button')}
        </Button>
      )}
    </div>
  )
}

// Member installs route through the migration while the retired plugin is on the printer: the exact
// specs a plain "Install all" would send, prefixed by the old plugin's removal. Standing where
// onInstallSelected stands keeps the config capture flow identical.
function migrateTarget(collection: Collection, onMigrateSelected: (printerId: string, migration: PluginMigration) => void) {
  return function installThroughMigration(printerId: string, specs: PluginUpdateSpec[]) {
    onMigrateSelected(printerId, { migratingPluginId: collection.id, comingOffThePrinter: true, arrivingSpecs: specs })
  }
}

interface CollectionDetailProps {
  collection: Collection
  plugins: Plugin[]
  // The full catalog collection pool, so a member that is itself a collection resolves to its plugins.
  collections: Collection[]
  installedIds: string[]
  printerId?: string
  installing: boolean
  // Live print state, so installing a whole collection answers to the same gate a single install does.
  printActive: boolean
  blockedActions: string[]
  // What this printer answered it is running, so a member needing a newer daemon is refused here for
  // the same reason its own card greys it out.
  daemonVersion?: string
  savedPluginVars?: Record<string, string>
  onSaveVars?: (save: PluginVarsSave) => void
  onInstallSelected?: (printerId: string, specs: PluginUpdateSpec[]) => void
  // Migrates a plugin that became a collection: the retired plugin off the printer, then the members on.
  onMigrateSelected?: (printerId: string, migration: PluginMigration) => void
  // Open a member plugin's own detail (the store closes this modal and opens the plugin panel).
  onOpenPlugin: (plugin: Plugin) => void
  onClose: () => void
}

// The collection detail modal: a brief readme, the member list with installed members marked, and one
// "Install all" that batches the missing members (single restart). The collection itself is never an
// installed entity - there is no uninstall, no persisted state; the view reflects live member state.
export function CollectionDetailPanel({ collection, plugins, collections, installedIds, printerId, installing, printActive, blockedActions, daemonVersion, savedPluginVars, onSaveVars, onInstallSelected, onMigrateSelected, onOpenPlugin, onClose }: CollectionDetailProps) {
  const { t } = useI18n()
  const members = collectionMembers(collection, plugins, collections)
  const split = splitMembers(collection, plugins, collections, installedIds)
  const total = split.installed.length + split.missing.length
  const fullyInstalled = total > 0 && split.missing.length === 0
  const became = !!onMigrateSelected && pluginBecameCollection(collection, installedIds)
  const [migrationStarted, setMigrationStarted] = useState(false)
  const migrated = migrationStarted && !became
  const gateContext = { catalogPlugins: plugins, installedIds, savedVars: savedPluginVars ?? {}, printerId, printActive, blockedActions, daemonVersion }
  const migrateAdapter = became && onMigrateSelected ? migrateTarget(collection, onMigrateSelected) : undefined
  const install = useCollectionInstall({ ...gateContext, onSaveVars, onInstallSelected: migrateAdapter ?? onInstallSelected })
  const gated = splitByBatchGate(t, split.missing, gateContext)
  const blockedMembers = new Map(gated.blocked.map((row) => [row.plugin.id, row.block]))

  function openRef(ref: B3dEntityRef) {
    const target = plugins.find((plugin) => plugin.id === ref.name)
    if (target) onOpenPlugin(target)
  }

  // Every member already installed leaves nothing to install: the migration is the removal alone, so
  // it skips the install builder (which refuses an empty batch) and posts the empty spec list itself.
  function startMigration() {
    if (!printerId || !onMigrateSelected) return
    setMigrationStarted(true)
    if (gated.eligible.length === 0) {
      onMigrateSelected(printerId, { migratingPluginId: collection.id, comingOffThePrinter: true, arrivingSpecs: [] })

      return
    }
    install.installMembers(gated.eligible)
  }

  return (
    <>
      <Modal onClose={onClose} surfaceClassName="plugin-modal">
        <Button variant="ghost" icon className="panel-close" onClick={onClose} aria-label={t('btn.close')}><IconClose size={16} /></Button>
        <CollectionHead collection={collection} fullyInstalled={fullyInstalled} t={t} />
        <div className="panel-scroll">
          <div className="panel-body">
            <Markdown source={collection.doc ?? collection.description} assets={docAssetsFor(collection.id)} onB3dRef={openRef} />
            <h3>{t('collection.included', { count: total })}</h3>
            <div className="dep-list">
              {members.map((member) => (
                <MemberRow key={member.id} member={member} installed={installedIds.includes(member.id)} block={blockedMembers.get(member.id) ?? null} onOpen={() => onOpenPlugin(member)} t={t} />
              ))}
              {split.unavailable.map((member: CollectionMember) => (
                <div className="dep-row collection-member unavailable" key={member.id}>
                  <span className="name">{member.id}</span>
                  <span className="collection-member-add">{t('collection.member_unavailable')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {became || migrated ? (
          <MigrationFoot
            migrated={migrated} hasPrinter={!!printerId} installing={installing} blockedCount={gated.blocked.length}
            block={batchBlockReason(t, { printerId, printActive, blockedActions })}
            onMigrate={startMigration} onClose={onClose} t={t}
          />
        ) : (
          <CollectionFoot
            installableCount={gated.eligible.length} fullyInstalled={fullyInstalled} hasPrinter={!!printerId} installing={installing}
            block={batchBlockReason(t, { printerId, printActive, blockedActions })}
            onInstallAll={() => install.installMembers(gated.eligible)} onClose={onClose} t={t}
          />
        )}
      </Modal>
      {install.configPlugins && (
        <BatchConfigModal plugins={install.configPlugins} savedVars={savedPluginVars ?? {}} busy={installing} scopes={install.configScopes} onScopeChange={install.setConfigScope} onCancel={install.cancelConfig} onConfirm={install.confirmConfig} />
      )}
    </>
  )
}
