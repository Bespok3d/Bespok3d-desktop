// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../../data/types'
import type { TFunction } from '../../../../i18n'
import { useI18n } from '../../../../i18n/context'
import { Markdown } from '../../../common/content/Markdown'
import { docAssetsFor } from '../../../../data/catalog/shape'
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'
import { IconGlobe } from '../../../../design-system/icons'
import { isSideloaded } from '../derive'

function useLocalDoc(plugin: Plugin): string | null {
  // A build-bundled doc (plugin.doc) wins; otherwise read the sideloaded package's README at runtime.
  function loadDoc() {
    return plugin.doc ? Promise.resolve(null) : window.b3d.localStore.doc(plugin.id, 'README.md')
  }

  return useAsyncResource(loadDoc, [plugin.id, plugin.doc]).value
}

function DocBody({ plugin, localDoc, t }: { plugin: Plugin; localDoc: string | null; t: TFunction }) {
  if (plugin.doc) return <Markdown source={plugin.doc} assets={docAssetsFor(plugin.id)} />
  if (localDoc != null) return <Markdown source={localDoc} assets={{}} />

  return <p className="panel-doc-empty">{isSideloaded(plugin) ? t('store.doc_none') : t('store.doc_external_only')}</p>
}

export function PanelDoc({ plugin }: { plugin: Plugin }) {
  const { t } = useI18n()
  const localDoc = useLocalDoc(plugin)

  return (
    <div className="panel-body panel-doc">
      <DocBody plugin={plugin} localDoc={localDoc} t={t} />
      {plugin.homepage && (
        <a className="btn outline doc-homepage-link" href={plugin.homepage} target="_blank" rel="noreferrer">
          <IconGlobe size={14} />{t('store.doc_homepage')}
        </a>
      )}
    </div>
  )
}
