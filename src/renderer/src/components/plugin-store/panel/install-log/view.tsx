import { useState } from 'react'
import { useI18n } from '../../../../i18n/context'
import cx from '../../../../utils/cx'
import { IconCheckCircle, IconAlert, IconChevron } from '../../../../design-system/icons'

const PHASE_LABELS: Record<string, string> = {
  extract: 'install.phase.extract',
  modes: 'install.phase.modes',
  dirs: 'install.phase.dirs',
  symlinks: 'install.phase.symlinks',
  patches: 'install.phase.patches',
  ownership: 'install.phase.ownership',
  start: 'install.phase.start',
}

function PhaseIcon({ ok }: { ok: boolean }) {
  return ok
    ? <IconCheckCircle size={14} className="install-icon-ok" />
    : <IconAlert size={14} className="u-err u-shrink-0" />
}

function LogItem({ item, itemKey, expanded, onToggle }: {
  item: InstallLogItem; itemKey: string; expanded: boolean; onToggle: (key: string) => void
}) {
  const hasOutput = item.output.trim().length > 0

  return (
    <div className={cx('log-item', item.ok ? 'ok' : 'fail')}>
      <button
        className="log-item-head"
        onClick={() => hasOutput && onToggle(itemKey)}
        disabled={!hasOutput}
      >
        <PhaseIcon ok={item.ok} />
        <span className="log-item-label">{item.label}</span>
        {hasOutput && (
          <IconChevron size={10} style={{ transform: expanded ? 'rotate(180deg)' : undefined, flexShrink: 0 }} />
        )}
      </button>
      {expanded && <pre className="log-item-output">{item.output}</pre>}
    </div>
  )
}

function toggleSet(prev: Set<string>, key: string): Set<string> {
  const next = new Set(prev)
  if (next.has(key)) next.delete(key)
  else next.add(key)

  return next
}

function LogPhase({ phase, label, open, expandedItems, onTogglePhase, onToggleItem }: {
  phase: InstallLogPhase; label: string; open: boolean; expandedItems: Set<string>
  onTogglePhase: (id: string) => void; onToggleItem: (key: string) => void
}) {
  const itemCount = phase.items.length

  return (
    <div className={cx('log-phase', phase.ok ? 'ok' : 'fail')}>
      <button className="log-phase-head" onClick={() => itemCount > 0 && onTogglePhase(phase.id)} disabled={itemCount === 0}>
        <PhaseIcon ok={phase.ok} />
        <span className="log-phase-label">{label}</span>
        {itemCount > 0 && <span className="log-phase-count">{itemCount}</span>}
        {itemCount > 0 && <IconChevron size={12} style={{ transform: open ? 'rotate(180deg)' : undefined, flexShrink: 0 }} />}
      </button>
      {open && (
        <div className="log-phase-items">
          {phase.items.map((item, idx) => (
            <LogItem key={`${phase.id}:${idx}`} item={item} itemKey={`${phase.id}:${idx}`}
              expanded={expandedItems.has(`${phase.id}:${idx}`)} onToggle={onToggleItem} />
          ))}
        </div>
      )}
    </div>
  )
}

// The phase list, shared by the post-install modal and the installed-plugin Log tab.
export function InstallLogView({ log }: { log: InstallLog }) {
  const { t } = useI18n()
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  return (
    <div className="log-body">
      {log.phases.map((phase) => (
        <LogPhase key={phase.id} phase={phase} label={t(PHASE_LABELS[phase.id] ?? phase.id)}
          open={expandedPhases.has(phase.id)} expandedItems={expandedItems}
          onTogglePhase={(id) => setExpandedPhases((prev) => toggleSet(prev, id))}
          onToggleItem={(key) => setExpandedItems((prev) => toggleSet(prev, key))} />
      ))}
    </div>
  )
}
