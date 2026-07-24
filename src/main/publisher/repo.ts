export const PUBLISHER_REPO = 'bespok3d-publisher'

export function keyFilePath(fingerprint: string): string {
  return `keys/${fingerprint}/key.asc`
}
