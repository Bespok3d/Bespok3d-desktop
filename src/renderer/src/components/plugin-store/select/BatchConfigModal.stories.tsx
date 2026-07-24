import { useState } from 'react'
import { BatchConfigModal } from './BatchConfigModal'
import { makePlugin } from '../../../test/fixtures'
import type { Plugin, PluginConfigField } from '../../../data/types'
import type { ScopeChoice } from '../../../data/plugin-vars'
import '../plugin-store.css'

export default { title: 'Store / Batch config' }

const SPOOLMAN_FIELDS: PluginConfigField[] = [
  { key: 'SPOOLMAN_SERVER', label: 'Server URL', type: 'text', scope: 'global', required: true, placeholder: 'http://host:7912', hint: 'Moonraker reads spool data from this address.' },
  { key: 'SPOOLMAN_MODE', label: 'Mode', type: 'select', options: ['auto', 'manual'], default: 'auto', scope: 'global' },
  { key: 'SPOOLMAN_LOCATION', label: 'Location', type: 'text', scope: 'printer', hint: 'Where THIS printer files its spools in Spoolman.' },
]

const SPOOLMAN_PLUGIN = makePlugin({
  id: 'spoolman', name: 'spoolman', title: 'Spoolman', category: 'filament',
  tagline: 'Track the active spool', config: SPOOLMAN_FIELDS,
})

const AUTH_PLUGIN = makePlugin({
  id: 'moonraker-auth', name: 'moonraker-auth', title: 'Moonraker Login', category: 'system',
  tagline: 'Require a login on the printer web UIs',
  config: [{ key: 'FORCE_LOGINS', label: 'Require login', type: 'toggle', onValue: 'true', offValue: 'false', default: 'false', scope: 'global' }],
})

const CAPTURE_PLUGINS = [SPOOLMAN_PLUGIN, AUTH_PLUGIN]

function noop() {}

function hintScopes(plugins: Plugin[]): Record<string, ScopeChoice> {
  return Object.fromEntries(plugins.flatMap((plugin) => (plugin.config ?? []).map((field) => [field.key, field.scope])))
}

// Owns the per-field scope choices the batch flow will keep once wired, seeded from each field's
// manifest hint exactly as the detail panel's usePanelConfigState seeds its own.
function ScopedCapture() {
  const [scopes, setScopes] = useState<Record<string, ScopeChoice>>(() => hintScopes(CAPTURE_PLUGINS))

  return (
    <BatchConfigModal
      plugins={CAPTURE_PLUGINS}
      savedVars={{ SPOOLMAN_MODE: 'auto' }}
      busy={false}
      scopes={scopes}
      onScopeChange={(fieldKey, choice) => setScopes((chosen) => ({ ...chosen, [fieldKey]: choice }))}
      onCancel={noop}
      onConfirm={noop}
    />
  )
}

// The R5 proposal under review: every captured field carries the same All printers / This printer
// control the detail panel's edit mode uses, preset by its manifest hint (server + mode + login
// shared, location per-printer). The required empty Server URL keeps Install disabled until filled,
// exactly as in the real flow.
export function ScopeAwareCapture() {
  return <ScopedCapture />
}

// Today's shipped treatment for comparison: no scope control anywhere; the capture silently lands
// each value in its hint-driven scope. This is what production renders until the review picks the
// treatment above (or a lighter one).
export function SilentCaptureToday() {
  return (
    <BatchConfigModal
      plugins={CAPTURE_PLUGINS}
      savedVars={{ SPOOLMAN_MODE: 'auto' }}
      busy={false}
      onCancel={noop}
      onConfirm={noop}
    />
  )
}
