# Become a verifiable plugin publisher

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** plugin author, **I want** to establish a verifiable identity linked to my GitHub account, **so that** users see "community package by @username" (blue) when they install my plugins instead of "unknown publisher" (yellow).

## Acceptance criteria

- [ ] A key is generated locally (or an existing key is selected)
- [ ] GitHub is connected (Device Flow if not already linked)
- [ ] The key's public part is uploaded to the identity repo; the identity repo is linked to the key record
- [ ] After uploading, the lookup `GET /repos/{username}/bespok3d-publisher/contents/{fingerprint}.asc` returns the key file
- [ ] Any package signed with this key and indexed in a list that carries `{github_username}` as the author is shown as community tier (blue) in the installer UI

## Flags

> ⚠️ **CONFLICT** - The publisher-identity decision specifies the repo must be named `bespok3d-publisher`. The current implementation defaults to `bespok3d-identity` and allows any name. If the repo is not named `bespok3d-publisher`, the community-tier lookup in other clients will fail. **This is a blocking conflict that must be resolved before the publisher enrollment story can be finalized.** Options:
> 1. Rename the implementation default to `bespok3d-publisher`
> 2. Update the publisher-identity decision to allow arbitrary repo names and add a discovery mechanism (e.g., a `.well-known` file or a separate lookup)
> 3. Keep `bespok3d-identity` for the Bespok3d-native trust flow and abandon cross-client GitHub lookup

> ⚠️ **CONFLICT** - The publisher-identity decision implies one `bespok3d-publisher` repo per GitHub account (all keys in one repo). The implementation tracks one identity repo per key. A publisher with two keys would need two repos - which violates the naming convention (both can't be `bespok3d-publisher`). If the convention is one-repo-per-publisher, all keys for that publisher go in one repo and the per-key `identityRepo` field is wrong.

> ❓ **UNCLEAR** - The publisher-identity decision mentions the `github_username → fingerprint` mapping is embedded in the `index.json` registry by the list maintainer. So the lookup is not purely client-driven; the list must carry this metadata. How does the list maintainer learn the publisher's GitHub username? Manual entry? From a PR the publisher submits? This is the enrollment ceremony and it is not described anywhere.

> 🔲 **UNKNOWN** - The "Become a publisher" shortcut that the publisher-identity decision mentions (sequences generate → connect → publish in one flow) is not implemented. Current UI requires three separate steps across two Settings panes.
