# Enroll as a verified manufacturer

**Owner:** the Bespok3d org registries, no repo in this workspace.

**Also touches:** the app repo (`Bespok3d-desktop`), the adapters repo (`adapters`).

**As a** hardware manufacturer, **I want** to have my signing key recognized at the manufacturer trust tier (magenta), **so that** users see a "verified manufacturer" badge on adapters and packages we publish.

## Acceptance criteria

- [ ] Manufacturer generates a GPG keypair for their organization (may be done in the app or externally)
- [ ] Manufacturer submits the fingerprint to the Bespok3d org by opening an issue on `bespok3d-org/bespok3d-trusted-manufacturers`
- [ ] Bespok3d org reviews the submission, verifies the manufacturer has a real adapter and tested hardware support, and merges a PR adding the fingerprint
- [ ] The app ships a signed snapshot of `bespok3d-trusted-manufacturers` and refreshes it on update
- [ ] Packages signed with an enrolled manufacturer key display the magenta "verified manufacturer" badge
- [ ] Manufacturer key revocation is handled by removing the entry from the repo via PR; clients refresh on next update

## Flags

> 🔲 **UNKNOWN** - The `bespok3d-org/bespok3d-trusted-manufacturers` repo does not exist yet.

> 🔲 **UNKNOWN** - The app does not yet fetch or apply the trusted-manufacturers list. The magenta trust tier is defined in the trust-tier decision but not rendered anywhere in the current UI.

> ❓ **UNCLEAR** - The publisher-identity decision says "criteria: the adapter is maintained and tested on real hardware." Who on the Bespok3d org performs this verification, and what does it look like? There is no review checklist or timeline commitment.

> ❓ **UNCLEAR** - Key rotation for manufacturers is not described. The key-lifecycle decision covers publisher key rotation but the trusted-manufacturers repo is a static list. If a manufacturer's key is compromised, how do they rotate it and communicate the transition to existing clients that have cached the old fingerprint?
