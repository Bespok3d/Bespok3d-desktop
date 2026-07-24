// Marks a thrown message as a daemon integrity refusal: the .b3 archive carried members its signed
// manifest does not vouch for (undeclared or escaping files), or a listed file whose bytes did not
// match. That is a defect in how those BYTES were built, not a printer fault. It reaches the user only
// once the install path has re-downloaded the package and been refused again (store/install.ts), so by
// the time this is shown the copy on the printer's doorstep is the release as it stands now.
// Like package-refused.ts this is kept import-free so the renderer (plugin-store/panel/gates/
// malformed.ts) can share the prefix, and the payload rides across Electron's IPC as part of the
// message string, since only the string survives the main/renderer boundary.
//
// The daemon emits a machine reason token plus the offending paths (ADR-0037); both are JSON-encoded
// after the prefix so the renderer can name the token and list the paths in its own locale.
export const MALFORMED_PACKAGE_PREFIX = 'MALFORMED_PACKAGE: '

export type MalformedPackageDetail = { reason: string; paths: readonly string[] }

export function malformedPackageMessage(reason: string, paths: readonly string[]): string {
  return `${MALFORMED_PACKAGE_PREFIX}${JSON.stringify({ reason, paths })}`
}
