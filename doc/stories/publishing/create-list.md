# Create and publish a curated plugin list

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** list publisher, **I want** to maintain a signed `index.json` that other users can subscribe to, **so that** I can curate a set of plugins I trust and share that curation with the community.

## Acceptance criteria

- [ ] A list publisher creates a git repo for their list (e.g., `best-camera-plugins`)
- [ ] The repo contains a signed `index.json` referencing plugins by their release asset URLs and publisher fingerprints
- [ ] The app provides tooling (or instructions) to generate and sign a valid `index.json`
- [ ] Other users can add the list by URL (Settings → Registries → Add)
- [ ] The app fetches, verifies the signature, and merges the list into its local catalog
- [ ] The list publisher's identity tier (unknown/community/org/manufacturer) is shown next to the list in Settings → Registries

## Flags

> 🔲 **UNKNOWN** - No list editing or publishing UI exists. Creating a list requires manual JSON editing and GPG signing on the command line. The app does not assist.

> 🔲 **UNKNOWN** - The `index.json` schema is not finalized (see also `publish-plugin.md`). Required fields, optional fields, and versioning are undefined.

> 🔲 **UNKNOWN** - "Settings → Registries" does not exist yet. Users cannot subscribe to third-party lists.

> ❓ **UNCLEAR** - If a list references a plugin that is also in the official Bespok3d list but with a different version, which wins? The signed-list decision says "latest version from the highest-trust source wins" but trust is on the list, not the version. If two community-tier lists disagree, is it user-configurable? Alphabetical? First-added wins?
