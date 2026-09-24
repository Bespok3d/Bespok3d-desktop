// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export const PUBLISHER_REPO = 'bespok3d-publisher'

// Where the org registers a publisher key when the publisher's own repository does not (yet) carry
// it. The bucket filename is the registration's own contract (main-index/keys/README.md): the
// account, lowercased, then the key's role. `bespok3d-list.pub.asc` and `lixnix-publisher.pub.asc`
// are the same shape, so a lookup can rebuild the name from the account it already proved.
export const MAIN_INDEX_OWNER = 'Bespok3d'
export const MAIN_INDEX_REPO = 'main-index'

export function keyFilePath(fingerprint: string): string {
  return `keys/${fingerprint.toLowerCase()}/key.asc`
}

export function indexBucketKeyFile(account: string): string {
  return `keys/${account.toLowerCase()}-publisher.pub.asc`
}
