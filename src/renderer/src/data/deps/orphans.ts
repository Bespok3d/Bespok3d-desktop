import type { Plugin } from '../types'

// A plugin installed on the printer that NO catalog source offers anymore (e.g. its sideloaded copy
// was removed while kept on the printer, with no bundled/online alternative). It is synthesized with
// an empty `sources` list, which the panel reads as "remove only": there is nothing to (re)install
// from, so the user can only uninstall it.
function synthOrphan(id: string, version: string): Plugin {
  return {
    id,
    name: id,
    title: id,
    category: 'other',
    tagline: '',
    description: '',
    version,
    channel: 'stable',
    publisher: 'LOCAL',
    signer: null,
    trust: 'any',
    deps: [],
    conflicts: [],
    sources: [],
  }
}

export function orphanPlugins(catalog: Plugin[], installedIds: string[], installedVersions: Record<string, string>): Plugin[] {
  const known = new Set(catalog.map((plugin) => plugin.id))

  return installedIds.filter((id) => !known.has(id)).map((id) => synthOrphan(id, installedVersions[id] ?? ''))
}
