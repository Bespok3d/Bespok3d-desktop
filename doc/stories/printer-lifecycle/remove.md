# Remove a printer

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to remove a printer from my list, **so that** I can clean up machines I no longer manage without reinstalling the app.

## Acceptance criteria

- [x] Settings → Printers shows a "Remove printer" button for each configured printer
- [x] Clicking it shows a confirmation step before removing
- [x] After confirmation the printer is removed from the list and from disk; it no longer appears in the sidebar or any dropdowns
- [ ] Removing a printer does not uninstall the daemon or plugins from the printer hardware - the printer side is untouched; only the local app record is removed
- [ ] If the removed printer had a key assigned via the Printers purpose chip, that assignment is cleared

## Flags

> 🔲 **UNKNOWN** - There is no "unenroll" flow. Removing the app record does not revoke the client key from the daemon's ACL on the printer. If the user re-adds the same printer, the daemon still has the old key and may accept or reject the new enrollment depending on the ACL state. A "Remove and revoke" option that SSHes into the printer and removes the app's key from the ACL is not designed.

> ❓ **UNCLEAR** - After removal, the printer's enrollment log (step history) is lost. Should it be archived locally in case the user needs to debug why re-enrollment behaves differently?
