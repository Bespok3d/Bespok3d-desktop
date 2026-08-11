// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Plugin } from '../../../../data/types'
import { useI18n } from '../../../../i18n/context'
import { Explainer } from '../../../common/content/Explainer'
import { Markdown } from '../../../common/content/Markdown'
import { isOrphan } from '../derive'

export function PanelBody({ plugin, missingDeps, installed }: { plugin: Plugin; missingDeps: string[]; installed: boolean }) {
  const { t } = useI18n()

  return (
    <div className="panel-body">
      {isOrphan(plugin) && (
        <Explainer brief={t('store.orphan.title')} detail={t('store.orphan.detail')} />
      )}
      {plugin.description && (
        <div>
          <h3>{t('store.about')}</h3>
          <Markdown source={plugin.description} />
        </div>
      )}
      {plugin.deps.length > 0 && (
        <div>
          <h3>{t('store.depends_on')}</h3>
          <div className="dep-list">
            {plugin.deps.map((dep) => (
              <div className="dep-row" key={dep}>
                <span className="name">{dep}</span>
              </div>
            ))}
          </div>
          {!installed && missingDeps.length > 0 && (
            <p className="dep-note">{t('store.deps_autoinstall', { deps: missingDeps.join(', ') })}</p>
          )}
        </div>
      )}
      {plugin.endpoints && plugin.endpoints.length > 0 && (
        <div>
          <h3>{t('store.endpoints')}</h3>
          <div className="endpoints">
            {plugin.endpoints.map((endpoint) => (
              <div className="endpoint" key={endpoint.path}><span className="endpoint-label">{endpoint.label}</span><code>{endpoint.path}</code></div>
            ))}
          </div>
        </div>
      )}
      {plugin.macros && plugin.macros.length > 0 && (
        <div>
          <h3>{t('store.macros')}</h3>
          <div className="macro-list">
            {plugin.macros.map((macro) => (
              <div className="macro-row" key={macro.name}>
                <code className="macro-name">{macro.params ? `${macro.name} ${macro.params}` : macro.name}</code>
                <span className="macro-desc">{macro.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
