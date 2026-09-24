# Become a verifiable plugin publisher

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** plugin author, **I want** to establish a verifiable identity linked to my GitHub account, **so that** users see "community package by @username" (blue) when they install my plugins instead of "unknown publisher" (yellow).

## Acceptance criteria

- [x] A key is generated locally (the private half never leaves the machine)
- [x] GitHub is connected (Device Flow if not already linked)
- [x] The key's public part is uploaded to `bespok3d-publisher` under the account, at `keys/{fingerprint-lowercase}/key.asc`
- [x] After uploading, that path serves the key file to anyone, and its own fingerprint equals the `publisher` stamped into the manifest and atom
- [x] A package signed with this key and served from that account's repo earns the community tier in the installer UI once the signature checks out over the packed manifest bytes; the UI names the account as the proved signer

## Flags

> ✅ **RESOLVED** (2026-09-24, publisher-key-trust) - The convention is `bespok3d-publisher`, one repo per publisher account, keys at `keys/{fingerprint}/key.asc` (lowercase). No separate discovery mechanism is needed: the account is derived from where the artifact actually came from (the package `download_url`/`doc_url` owner, or the list's own URL), never from a claimed name.

> ✅ **RESOLVED** (2026-09-24, publisher-key-trust) - One repo per account answers the two-keys problem: both keys live in `bespok3d-publisher`, each in its own `keys/{fingerprint}/` directory. There is no per-key identity repo.

> ✅ **RESOLVED** (2026-09-24, publisher-key-trust) - No `github_username` mapping is embedded in any list and no list maintainer ceremony exists: the publisher account comes from the artifact's own provenance and the fingerprint from the artifact's declared `publisher`, so a list maintainer never learns anyone's username.

> 🔲 **UNKNOWN** - The "Become a publisher" shortcut that the publisher-identity decision mentions (sequences generate → connect → publish in one flow) is not implemented. Current UI requires the steps across Settings → Keys and Settings → Git Host.
