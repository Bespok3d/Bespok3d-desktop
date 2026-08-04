// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a person types into a service-address field, reduced to the host and port a plugin can use.
// People paste the whole browser URL ("http://192.168.1.50:8000/spoolman/") because that is what
// they have in front of them; the plugin wants "host" or "host:port" and simply fails, with nothing
// on screen saying why. Cleaning the typed value is what closes that gap.
import type { PluginConfigField } from './types'
import { serviceUrlError } from './service-url'

export interface ServiceAddress {
  host: string
  port: number
}

const WEB_PORT = 80
const SECURE_WEB_PORT = 443
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

// URL handles the parts that are easy to get wrong (credentials, IPv6 brackets, case folding, path,
// query, fragment), so a bare "host:port" is lent a scheme it never had just to go through the same
// parser as a pasted link.
function parsedUrl(typed: string): URL | null {
  const trimmed = typed.trim()
  if (!trimmed) return null

  try {
    return new URL(HAS_SCHEME.test(trimmed) ? trimmed : `http://${trimmed}`)
  } catch {
    return null
  }
}

// An https link with no port written in it means 443, and dropping that would leave the plugin
// talking to port 80. Anything else means the plain web port, which is what a bare host means too.
function impliedPort(url: URL): number {
  return url.protocol === 'https:' ? SECURE_WEB_PORT : WEB_PORT
}

// The host and port behind what was typed, or null when it cannot be read as an address at all.
export function serviceAddress(typed: string): ServiceAddress | null {
  const url = parsedUrl(typed)
  if (!url || !url.hostname) return null

  return { host: url.hostname, port: url.port ? Number(url.port) : impliedPort(url) }
}

// The value put back into the field: the host on its own when it answers on the plain web port, and
// "host:port" otherwise, which is exactly the form every plugin documents.
export function cleanServiceAddress(typed: string): string {
  const address = serviceAddress(typed)
  if (!address) return typed.trim()
  if (address.port === WEB_PORT) return address.host

  return `${address.host}:${address.port}`
}

// The message key for a typed address that cannot be used, or null when it can. An empty field is
// not an error here: whether it may be left empty is the `required` flag's business.
export function serviceAddressError(typed: string): string | null {
  if (!typed.trim()) return null
  if (serviceAddress(typed)) return null

  return 'store.address_unusable'
}

// The first unusable address across a config form, so install and reconfigure can be gated on it the
// same way a colliding web port already is.
export function configAddressError(
  fields: PluginConfigField[],
  values: Record<string, string>,
): string | null {
  const offender = fields.find((field) => fieldShapeError(field, values[field.key] ?? '') !== null)

  return offender ? fieldShapeError(offender, values[offender.key] ?? '') : null
}

// An address field carries a host and a port; a url field carries the whole thing, protocol and all.
// Every other kind of field has no shape to be wrong about.
function fieldShapeError(field: PluginConfigField, typed: string): string | null {
  if (field.type === 'url') return serviceUrlError(typed)
  if (field.type === 'address') return serviceAddressError(typed)

  return null
}
