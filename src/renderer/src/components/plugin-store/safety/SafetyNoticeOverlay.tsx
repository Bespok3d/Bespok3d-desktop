import type { Plugin, Printer } from '../../../data/types'
import type { SafetyNotice } from './notice'
import { SafetyRecoveryModal } from './RecoveryModal'

// Renders the popup only when a fixer kicked in; resolves the plugin from the catalog so the caller
// stays a one-liner and the null-handling lives here.
export function SafetyNoticeOverlay({ notice, plugins, printer, onClose }: {
  notice: SafetyNotice | null; plugins: Plugin[]; printer?: Printer | null; onClose: () => void
}) {
  if (!notice) return null
  const plugin = plugins.find((candidate) => candidate.id === notice.pluginId)

  return <SafetyRecoveryModal notice={notice} plugin={plugin} printer={printer} onClose={onClose} />
}
