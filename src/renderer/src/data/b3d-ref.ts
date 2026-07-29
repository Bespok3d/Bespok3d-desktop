// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Renderer-side b3d:// support. Two jobs: (1) the route type for links the OS hands us via
// window.b3d.onB3dOpen, kept in sync with main/b3d-url.ts; (2) parsing an ENTITY ref found inside a
// plugin/list description so the Markdown renderer can make it a clickable in-app link, resolved
// against the loaded catalog WITHOUT round-tripping through the OS protocol layer (ADR-0023).

export type { B3dRoute } from '@bespok3d/contract'

export interface B3dEntityRef {
  publisher: string
  name: string
  // Optional detail-panel tab to open the entity on, from the URL fragment (b3d://pub/name#captured).
  // A plugin's own doc can link straight to e.g. its Captured output tab.
  tab?: string
}

export function isB3dUrl(href: string): boolean {
  return href.startsWith('b3d://')
}

// Parse the entity form b3d://<publisher>/<item> (publisher = user@githost or legacy free string).
// Returns null for the reserved action hosts and anything malformed: a description should only ever
// link to entities, never trigger a system action.
export function parseEntityRef(href: string): B3dEntityRef | null {
  const url = toUrl(href)
  if (!url || url.protocol !== 'b3d:') return null
  if (!url.username && RESERVED_HOSTS.has(url.hostname)) return null
  const publisher = url.username ? `${url.username}@${url.hostname}` : url.hostname
  const name = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  const tab = url.hash.replace(/^#/, '') || undefined

  return publisher && name ? { publisher, name, tab } : null
}

const RESERVED_HOSTS = new Set(['registry', 'printer', 'auth'])

function toUrl(href: string): URL | null {
  try {
    return new URL(href)
  } catch {
    return null
  }
}
