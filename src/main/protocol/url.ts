// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure parser for the `b3d://` custom scheme (ADR-0023). A b3d:// URL is either an ENTITY path
// `b3d://<publisher>/<item>` (open a plugin/list in the store) or one of a small reserved set of
// system ACTIONS whose host is not a valid publisher (`registry`/`printer`/`auth`). The canonical
// publisher form is `user@githost` (ADR-0023 update); the legacy free-string form is still accepted.
// This is the single dispatch point the OS protocol handler AND the in-app description links both
// route through, so new b3d:// capabilities are added here, not scattered across call sites.

export type { B3dRoute } from '@bespok3d/contract'
import type { B3dRoute } from '@bespok3d/contract'

const RESERVED_HOSTS = new Set(['registry', 'printer', 'auth'])

function firstSegment(pathname: string): string {
  return pathname.replace(/^\/+/, '').split('/')[0] ?? ''
}

function entityName(pathname: string): string {
  return pathname.replace(/^\/+/, '').replace(/\/+$/, '')
}

function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  return [...params.entries()].reduce((object, [key, value]) => ({ ...object, [key]: value }), {})
}

function parseReserved(url: URL): B3dRoute {
  if (url.hostname === 'registry' && firstSegment(url.pathname) === 'add') {
    const target = url.searchParams.get('url')

    return target ? { kind: 'registry-add', url: target } : { kind: 'unknown', raw: url.href }
  }
  if (url.hostname === 'printer') {
    const fingerprint = firstSegment(url.pathname)

    return fingerprint ? { kind: 'printer', fingerprint } : { kind: 'unknown', raw: url.href }
  }
  if (url.hostname === 'auth' && firstSegment(url.pathname) === 'callback') {
    return { kind: 'auth-callback', params: searchParamsToObject(url.searchParams) }
  }

  return { kind: 'unknown', raw: url.href }
}

function parseEntity(url: URL): B3dRoute {
  const publisher = url.username ? `${url.username}@${url.hostname}` : url.hostname
  const name = entityName(url.pathname)
  if (!publisher || !name) return { kind: 'unknown', raw: url.href }

  return { kind: 'entity', publisher, name }
}

export function parseB3dUrl(raw: string): B3dRoute {
  const url = toUrl(raw)
  if (!url || url.protocol !== 'b3d:') return { kind: 'unknown', raw }
  // A reserved host is only an action when it carries no publisher userinfo, so a real
  // `user@auth` publisher could never be hijacked by the reserved namespace.
  if (!url.username && RESERVED_HOSTS.has(url.hostname)) return parseReserved(url)

  return parseEntity(url)
}

function toUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}
