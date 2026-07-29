# Ban a key

**Owner:** the Bespok3d org registries, no repo in this workspace.

**Also touches:** the app repo (`Bespok3d-desktop`).

**As a** Bespok3d org member, **I want** to add a fingerprint to the banned-keys list with a written explanation, **so that** clients can flag packages signed by that key with a red danger indicator.

## Acceptance criteria

- [ ] A PR is opened on `bespok3d-org/bespok3d-banned-keys` adding the fingerprint and a mandatory explanation
- [ ] After the PR is merged, the app fetches the updated list on next launch or update
- [ ] Any package or list signed by a banned fingerprint is shown with a red danger indicator - the only context where red is used in the trust UI
- [ ] The ban entry is public and permanent; the reason is visible to any user who inspects the entry
- [ ] There is no appeal process; the ban cannot be reversed by the banned party

## Flags

> 🔲 **UNKNOWN** - `bespok3d-org/bespok3d-banned-keys` does not exist yet.

> 🔲 **UNKNOWN** - The app does not fetch or apply the banned-keys list. The red danger indicator is defined in the publisher-identity decision but not rendered anywhere in the current UI.

> ❓ **UNCLEAR** - What is the threshold for banning? The publisher-identity decision sets the bar at harm done on purpose, not bad packages or disputed quality. Who decides? One org member, or consensus? There is no documented governance process for the ban decision.

> ❓ **UNCLEAR** - Banned key detection at install time: does the app block installation, warn and allow, or just show the indicator? That decision says "flagged with a red danger indicator" which implies a warning, not a hard block. Is that the intent?
