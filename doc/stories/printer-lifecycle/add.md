# Add a printer

**Owner:** the adapters repo (`adapters`).

**Also touches:** the app repo (`Bespok3d-desktop`), the daemon repo (`daemon`).

**As a** Bespok3d user, **I want** to add a printer to my managed list, **so that** I can install plugins on it and track its state in the app.

## Acceptance criteria

- [x] Clicking "Add printer" from the sidebar opens a flow to add a printer
- [x] The flow accepts either a discovered printer (from mDNS) or a manually entered hostname/IP
- [x] During enrollment, the app connects over SSH and runs a 14-step install: base layer, WiFi persistence, DHCP cleanup, daemon deploy, TLS cert generation, ACL seeding, daemon start - with live progress UI including sub-step hints for long steps
- [x] After enrollment, the printer appears in the sidebar with `managed` status; the status persists across app restarts
- [x] The app distinguishes `managed` (daemon responding on port 4269) from `online` (printer reachable, no daemon) via TCP probe
- [x] Retry from any failed step is available; full reset option resets to credentials form
- [x] The enrollment history (all steps with labels) is viewable via a modal after enrollment
- [ ] The daemon's GPG public key fingerprint is shown to the user at the end of enrollment; the user is prompted to verify it matches what the printer displays - 🔲 requires printer-side display mechanism
- [ ] A printer can only be added once; adding the same fingerprint twice is a no-op - 🔲 requires daemon keypair deduplication

## Flags

> ❓ **UNCLEAR** - What happens when a user removes a printer and re-adds it? The daemon's ACL still contains the old client key. Does re-enrollment add a second ACL entry, or does the daemon detect the fingerprint matches and skip?

> 🔲 **UNKNOWN** - The fingerprint comparison step is mentioned in the key-lifecycle decision but there is no printer-side display mechanism. Manufacturers or the base layer would need to surface the fingerprint (e.g., on an LCD, in Klipper's `FIRMWARE_RESTART` output, or via a QR code). How this is presented to the user on the printer side is undefined.
