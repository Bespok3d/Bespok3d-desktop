import type { Plugin } from '../types'

function pluginById(plugins: Plugin[], pluginId: string): Plugin | undefined {
  return plugins.find((plugin) => plugin.id === pluginId)
}

export function resolveMissingDeps(plugins: Plugin[], pluginId: string, installedIds: string[]): string[] {
  const ordered: string[] = []
  const seen = new Set<string>()
  function collect(currentId: string) {
    const plugin = pluginById(plugins, currentId)
    if (!plugin) return
    plugin.deps.forEach((depId) => {
      if (seen.has(depId)) return
      seen.add(depId)
      collect(depId)
      if (!installedIds.includes(depId)) ordered.push(depId)
    })
  }
  collect(pluginId)

  return ordered
}

export function installedDependents(plugins: Plugin[], pluginId: string, installedIds: string[]): string[] {
  return plugins
    .filter((plugin) => installedIds.includes(plugin.id) && plugin.deps.includes(pluginId))
    .map((plugin) => plugin.id)
}

function collectDependents(plugins: Plugin[], pluginId: string, installedIds: string[], closure: Set<string>): void {
  installedDependents(plugins, pluginId, installedIds).forEach((dependent) => {
    if (closure.has(dependent)) return
    closure.add(dependent)
    collectDependents(plugins, dependent, installedIds, closure)
  })
}

// The extra installed plugins a batch uninstall of `selectedIds` would also have to remove: every
// transitive dependent of the selection that is not itself selected. Drives the cascade confirm before
// the batch runs (the daemon enforces the same via its dependents 409 backstop).
export function cascadeDependents(plugins: Plugin[], selectedIds: string[], installedIds: string[]): string[] {
  const closure = new Set<string>()
  selectedIds.forEach((pluginId) => collectDependents(plugins, pluginId, installedIds, closure))

  return [...closure].filter((dependentId) => !selectedIds.includes(dependentId))
}

function declaresConflict(plugins: Plugin[], installedId: string, pluginId: string): boolean {
  const installed = pluginById(plugins, installedId)

  return !!installed && installed.conflicts.includes(pluginId)
}

export function installedConflicts(plugins: Plugin[], pluginId: string, installedIds: string[]): string[] {
  const target = pluginById(plugins, pluginId)
  if (!target) return []
  const others = installedIds.filter((installedId) => installedId !== pluginId)
  const clashing = others.filter((installedId) =>
    target.conflicts.includes(installedId) || declaresConflict(plugins, installedId, pluginId))

  return [...new Set(clashing)]
}
