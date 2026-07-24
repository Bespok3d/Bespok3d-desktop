// The .b3 manifest contract: parse and leniently validate the manifest.json a dropped package carries.
// Lenient on purpose (non-pedantic): accept anything the daemon could actually install, rejecting only
// what would make the package uninstallable (no id, no version, no install block).

const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/
const SAFE_VERSION = /^[0-9][0-9a-zA-Z.+-]*$/
const METADATA_KEYS = ['title', 'description', 'tagline', 'category', 'channel'] as const

export class B3ValidationError extends Error {}

export interface StoredManifest {
  name: string
  version: string
  install: Record<string, unknown>
  [key: string]: unknown
}

function parseJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new B3ValidationError('its manifest.json is not valid JSON')
  }
}

export function parseManifest(text: string): StoredManifest {
  const manifest = parseJson(text)
  const name = manifest.name
  if (typeof name !== 'string' || !SAFE_ID.test(name)) {
    throw new B3ValidationError('its manifest has no valid plugin name (lowercase letters, digits and dashes)')
  }
  if (typeof manifest.version !== 'string' || !SAFE_VERSION.test(manifest.version)) {
    throw new B3ValidationError(`plugin "${name}" has no valid version`)
  }
  if (typeof manifest.install !== 'object' || manifest.install === null) {
    throw new B3ValidationError(`plugin "${name}" has no install block, so it cannot be installed`)
  }

  return manifest as unknown as StoredManifest
}

// Whether the manifest carries every catalog-display field. A package missing one still installs; the
// UI uses this to badge it as metadata-thin (the Create tool can then prompt to fill the gaps).
export function metadataComplete(manifest: StoredManifest): boolean {
  return METADATA_KEYS.every((key) => typeof manifest[key] === 'string' && (manifest[key] as string).length > 0)
}
