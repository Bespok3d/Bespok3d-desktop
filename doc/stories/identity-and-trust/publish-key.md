# Publish a key to a git host

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to publish my GPG public key to a git-hosted repository, **so that** other users and the app can look up my identity and verify packages I sign.

## Acceptance criteria

- [x] Each key row has a globe icon button; grey = not published, green = published
- [x] If no git host is connected, the button is disabled with a tooltip "Connect a git host in Settings → Git Host"
- [x] If the key has no identity repo yet, clicking the button opens a flyout with a repo name input field
- [x] The input field pre-fills with `bespok3d-identity`; if that name is already taken on the git host, it pre-fills with `bespok3d-identity_<key-label-slug>`
- [x] An autocomplete datalist shows existing repos the user owns; entering an existing `owner/repo` uses that repo instead of creating a new one
- [x] Clicking "Publish key" uploads the public key as `keys/{fingerprint}.asc` in the repo; the repo is created if it does not exist
- [x] After publishing, the globe icon turns green and the tooltip shows `owner/repo`
- [x] The published button's flyout shows: "Re-upload key", "Remove from git host", and "View repository" (opens browser)
- [x] Each key's published state is tracked independently - publishing key A does not affect key B

## Flags

> ⚠️ **CONFLICT** - The publisher-identity decision specifies the identity repo must be named `bespok3d-publisher` and the lookup URL is `GET /repos/{username}/bespok3d-publisher/contents/{fingerprint}.asc`. The current implementation uses `bespok3d-identity` as the default name and supports arbitrary repo names. If the app creates a repo named `bespok3d-identity`, the community trust tier lookup will fail because other clients will look for `bespok3d-publisher`. **Decision needed: adopt one convention.**

> ⚠️ **CONFLICT** - The publisher-identity decision implies one identity repo per publisher account (`bespok3d-publisher` is singular). The implementation tracks one repo per key (`identityRepo` field on `KeyRecord`). A user with two keys would have two identity repos - but that decision's lookup only looks at `bespok3d-publisher`. Which model is correct?

> ❓ **UNCLEAR** - The key-lifecycle decision says publisher key rotation uploads a transition statement to the publisher's repo as `{old_fingerprint}-transition.asc`. With per-key repos, where does the transition statement go - the old key's identity repo or the new key's? The rotation UI is not implemented.

> ❓ **UNCLEAR** - The "Remove from git host" action deletes the `.asc` file from the identity repo but does not delete the repo itself. If the repo is empty afterwards, is that acceptable? Should the app offer to delete the repo?
