# Assign a signing key to a printer

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** the daemon repo (`daemon`).

**As a** Bespok3d user, **I want** to assign a specific GPG key to a printer, **so that** that key is used to authenticate my client to the printer's daemon.

## Acceptance criteria

- [x] In Settings → Keys, a "Printers" purpose chip appears on each key row
- [x] Clicking the chip opens a dropdown listing all configured printers by name
- [x] Selecting a printer assigns that key to it; selecting a different key for the same printer removes the previous assignment
- [x] A key with no printer assignment falls back to the default key
- [x] The assigned key is shown inline on the chip (e.g., "Printers · Snap U1")

## Flags

> 🔲 **UNKNOWN** - The printer key assignment is stored in the client app only. The daemon's ACL is not updated when a key is reassigned here. The link between "key assigned to printer X in the app" and "key in daemon's ACL on printer X" is not implemented. What triggers the daemon ACL update?

> ❓ **UNCLEAR** - If the user has two keys and assigns key A to printer X, then later makes key B the default, which key is used for printer X? The current intent is "explicit assignment wins over default" but this is not codified in any settled decision.

> 🔲 **UNKNOWN** - Multi-device scenario (phone + laptop both using the app): each device holds its own keypair. The Printers purpose chip only covers the current device's key. No story or settled decision covers how a second device enrolls itself with a printer's daemon.
