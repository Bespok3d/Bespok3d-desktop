import { useEffect } from 'react'
import type { Printer } from '../data/types'
import type { B3dRoute } from '../data/b3d-ref'

interface B3dNav {
  printers: Printer[]
  openPlugin: (name: string) => void
  openRepos: () => void
  selectPrinter: (id: string) => void
}

function routeB3dOpen(route: B3dRoute, nav: B3dNav): void {
  if (route.kind === 'entity') return nav.openPlugin(route.name)
  if (route.kind === 'registry-add') return nav.openRepos()
  if (route.kind === 'printer' && nav.printers.some((printer) => printer.id === route.fingerprint)) nav.selectPrinter(route.fingerprint)
}

// A b3d:// link the OS handed us (window.b3d.onB3dOpen) maps to an in-app navigation; every route is
// a navigation only, never a silent state change (ADR-0023).
export function useB3dDeepLinks(nav: B3dNav): void {
  useEffect(() => window.b3d.onB3dOpen((route) => routeB3dOpen(route, nav)), [nav.printers])
}
