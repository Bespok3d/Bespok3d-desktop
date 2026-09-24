# Publish a key to a git host

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to publish my GPG public key to a git-hosted repository, **so that** other users and the app can look up my identity and verify packages I sign.

## Acceptance criteria

- [x] Each key row has a globe icon button; grey = not published, green = published and verified, alert = some other file sits at the key path
- [x] If no git host is connected, the button is disabled with a tooltip "Connect a git host in Settings → Git Host"
- [x] Publication writes to the one conventional repository `bespok3d-publisher` under the signed-in account, created if it does not exist; every key of that account lives there
- [x] The public key is uploaded as `keys/{fingerprint-lowercase}/key.asc`, matching the atom and manifest `publisher` spelling
- [x] After publishing, the globe icon turns green, the tooltip shows `owner/bespok3d-publisher`, and the flyout states what was verified: that file is this key's public half
- [x] The published button's flyout shows: "Unpublish key" and "Open in browser"; unpublishing removes the key file and the README row
- [x] The private half never leaves the machine except by an explicit "Download, Private key" export
- [x] Each key's published state is tracked independently - publishing key A does not affect key B
- [x] The whole flow works in a released build (the Keys pane is not behind development features)

## Flags

> ✅ **RESOLVED** (2026-09-24, publisher-key-trust) - One convention: the repo is `bespok3d-publisher`, one per publisher account, and the lookup path is `keys/{fingerprint}/key.asc` with a lowercase fingerprint. There is no per-key identity repo and no `identityRepo` field to reconcile: all of an account's keys live in that one repo. Consumers look in the account's own repo first and fall back to `main-index/keys/<account-lowercased>-publisher.pub.asc`; the fetched key's own fingerprint must equal the declared `publisher` (hex, case-blind) and the signature must check out over the exact bytes before anything is trusted.

> ❓ **UNCLEAR** - The key-lifecycle decision says publisher key rotation uploads a transition statement to the publisher's repo as `{old_fingerprint}-transition.asc`. The rotation UI is not implemented, so where that statement lands (inside the shared `bespok3d-publisher` repo beside the old key directory) is still open.

> ❓ **UNCLEAR** - The "Remove from git host" action deletes the key file and its README row but does not delete the repo itself. If the repo is empty afterwards, is that acceptable? Should the app offer to delete the repo?
