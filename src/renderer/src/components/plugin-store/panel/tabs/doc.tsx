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
import { useReleasedDoc } from '../released-doc'

function useLocalDoc(plugin: Plugin): string | null {
  // A build-bundled doc (plugin.doc) wins; otherwise read the sideloaded package's README at runtime.
  function loadDoc() {
    return plugin.doc ? Promise.resolve(null) : window.b3d.localStore.doc(plugin.id, 'README.md')
  }

  return useAsyncResource(loadDoc, [plugin.id, plugin.doc]).value
}

function DocBody({ plugin, doc, localDoc, t }: { plugin: Plugin; doc: string | undefined; localDoc: string | null; t: TFunction }) {
  if (doc) return <Markdown source={doc} assets={docAssetsFor(plugin.id)} />
  if (localDoc != null) return <Markdown source={localDoc} assets={{}} />

  return <p className="panel-doc-empty">{isSideloaded(plugin) ? t('store.doc_none') : t('store.doc_external_only')}</p>
}

export function PanelDoc({ plugin }: { plugin: Plugin }) {
  const { t } = useI18n()
  const doc = useReleasedDoc(plugin.docUrl, plugin.doc)
  const localDoc = useLocalDoc(plugin)

  return (
    <div className="panel-body panel-doc">
      <DocBody plugin={plugin} doc={doc} localDoc={localDoc} t={t} />
      {plugin.homepage && (
        <a className="btn outline doc-homepage-link" href={plugin.homepage} target="_blank" rel="noreferrer">
          <IconGlobe size={14} />{t('store.doc_homepage')}
        </a>
      )}
    </div>
  )
}
