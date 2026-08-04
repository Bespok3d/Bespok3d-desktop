// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A whole address, protocol and all, kept exactly as it was typed. A service can sit behind a name
// and a certificate on the standard web port, so reducing what was typed to "host:port" throws the
// protocol away and sends the printer somewhere else. Nothing here rewrites an address: it says
// whether the address can be used, and it lends a protocol to one typed without any.

export const SERVICE_SCHEMES = ['http', 'https'] as const

export type ServiceScheme = (typeof SERVICE_SCHEMES)[number]

const SCHEME_SEPARATOR = '://'
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

function isServiceScheme(candidate: string): candidate is ServiceScheme {
  return SERVICE_SCHEMES.some((scheme) => scheme === candidate)
}

// The protocol written in front of what was typed, or null when there is none we can speak. Anything
// other than http or https reads as none, so the message names it rather than passing it through.
export function typedScheme(typed: string): ServiceScheme | null {
  const head = typed.trim().split(SCHEME_SEPARATOR)[0].toLowerCase()

  return isServiceScheme(head) ? head : null
}

// The same address carried over to a chosen protocol: picking https after typing 192.0.2.50:8000
// gives back https://192.0.2.50:8000 and nothing else about it moves.
export function withScheme(typed: string, scheme: ServiceScheme): string {
  return `${scheme}${SCHEME_SEPARATOR}${typed.trim().replace(ANY_SCHEME, '')}`
}

// What was typed, read as a URL, or null when it cannot be read as one.
export function serviceUrl(typed: string): URL | null {
  if (!typedScheme(typed)) return null

  try {
    const parsed = new URL(typed.trim())

    return parsed.hostname ? parsed : null
  } catch {
    return null
  }
}

// The message key for an address that cannot be used yet, or null when it can. Empty is not an error
// here: whether the field may be left empty is the `required` flag's business.
export function serviceUrlError(typed: string): string | null {
  const trimmed = typed.trim()
  if (!trimmed) return null
  if (ANY_SCHEME.test(trimmed)) return serviceUrl(trimmed) ? null : 'store.address_unusable'
  if (!serviceUrl(withScheme(trimmed, 'http'))) return 'store.address_unusable'

  return 'store.address_pick_scheme'
}
