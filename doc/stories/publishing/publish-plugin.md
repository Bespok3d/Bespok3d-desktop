# Publish a plugin

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** plugin author, **I want** to publish a new version of my plugin through the app, **so that** users can discover and install it without me manually managing GitHub releases.

## Acceptance criteria

- [ ] A "Publish" flow accepts a `.b3p` bundle (the package-format decision format)
- [ ] The app signs the bundle with the key assigned to the "Packages" purpose
- [ ] The signed release is uploaded as a GitHub release asset to the configured plugin repo
- [ ] The repo's `index.json` is updated with the new version entry, including the fingerprint, version, and asset URL
- [ ] `index.json` is re-signed with the publisher's key after update
- [ ] The release is published (not draft)

## Flags

> 🔲 **UNKNOWN** - The publish flow UI does not exist. The IPC layer for `createRelease`, `uploadAsset`, and `publishRelease` is implemented (the release-distribution decision) but there is no app UI that drives it.

> 🔲 **UNKNOWN** - When the user has multiple plugin repos configured, the app must choose (or ask) which repo to publish to. No selection UI or heuristic is designed.

> 🔲 **UNKNOWN** - The `.b3p` bundle format (the package-format decision) is defined but the tooling to create one from a plugin source tree is not built.

> 🔲 **UNKNOWN** - `index.json` schema is not finalized. The signed-list decision describes the signed index concept but does not pin the JSON structure. Without a fixed schema, clients cannot parse list contents.

> ❓ **UNCLEAR** - Who owns the `index.json` in a plugin repo - the publisher or the list maintainer? The publisher's repo contains the release assets; the list maintainer's `index.json` indexes them. Does the publisher also maintain their own local `index.json` that list maintainers reference? Or does the list maintainer include the full entry?
