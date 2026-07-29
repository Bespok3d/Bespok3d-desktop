# Require GPG signature verification

**Owner:** the daemon repo (`daemon`).

**Also touches:** the app repo (`Bespok3d-desktop`).

**As a** Bespok3d user, **I want** to configure whether the app verifies GPG signatures on plugin packages, **so that** I can enforce trust guarantees that match my security posture.

## Acceptance criteria

- [x] Settings → Repositories → Verification shows a "Verify package signatures" toggle
- [x] The toggle is on by default with a "Recommended" hint
- [x] The hint explains the consequence: packages whose GPG signature does not match the publisher key are rejected
- [ ] When the toggle is on, the daemon refuses to install any `.b3p` bundle whose signature cannot be verified
- [ ] When the toggle is off, the daemon installs packages regardless of signature; the UI shows a persistent warning banner while the setting is disabled

## Flags

> 🔲 **UNKNOWN** - The toggle is rendered but not wired. Signature verification in the daemon (`_verify_sig()` in `packages.py`) exists as a stub that calls pgpy but the pgpy wheel is not pre-built for the U1's Python 3.11 environment. The toggle state is also not communicated to the daemon.

> 🔲 **UNKNOWN** - The daemon has no API endpoint to read or write the verification setting. A `/settings` route or a startup config file is needed to make this preference persistent on the printer side.

> ❓ **UNCLEAR** - Should signature verification be a global setting or per-source? Disabling it globally to install one unsigned community plugin lowers the bar for all sources. A per-source override would be safer but is not designed.
