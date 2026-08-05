// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'
import { Markdown } from '../../../common/content/Markdown'
import { docAssetsFor } from '../../../../data/catalog/shape'
import { IconExternalLink } from '../../../../design-system/icons'

// The licence is a link, never the wall of text: a full GPL in the panel buries the one line the user
// came for, which is who wrote this and what they are owed.
export function PanelLicence({ plugin }: { plugin: Plugin }) {
  const { t } = useI18n()

  return (
    <div className="panel-body panel-doc">
      {plugin.attributions
        ? <Markdown source={plugin.attributions} assets={docAssetsFor(plugin.id)} />
        : <p className="panel-doc-empty">{t('store.licence_attributions_none')}</p>}
      {plugin.licenseUrl && (
        <a className="btn outline doc-homepage-link" href={plugin.licenseUrl} target="_blank" rel="noreferrer">
          <IconExternalLink size={14} />{t('store.licence_read')}
        </a>
      )}
    </div>
  )
}
