# Uninstall Bespok3d from a printer

**Owner:** the adapters repo (`adapters`).

**Also touches:** the app repo (`Bespok3d-desktop`), the daemon repo (`daemon`).

**As a** Bespok3d user, **I want** to completely remove Bespok3d from my printer, **so that** the printer is exactly as it was before I enrolled it.

See also: [deactivate-bespok3d.md](deactivate-bespok3d.md) (reversible alternative).

## Acceptance criteria

- [x] Settings → Printers shows a "Remove Bespok3d" button for managed printers (not for deactivated printers)
- [x] Clicking Uninstall always shows a mandatory confirmation dialog (no "don't show again") with a danger-styled confirm button
- [x] The dialog explains that the action permanently removes all plugins and cannot be undone
- [x] After confirming, an SSH credentials form is shown
- [x] The uninstall flow streams progress steps in the enrollment progress UI
- [x] Steps: daemon uninstalls all plugins and removes config hooks; SSH removes S90lmd hook, nginx patch, S99bespok3d init script, udev rule, dhcpcd symlink, and `/userdata/bespok3d`
- [x] After uninstall, the printer record is removed from the app's printer list
- [x] `printer.cfg` and `moonraker.conf` contain no bespok3d include lines
- [x] The printer boots normally after reboot with no bespok3d traces

## Notes

This action is irreversible. To use Bespok3d again the printer must be re-enrolled from scratch.
