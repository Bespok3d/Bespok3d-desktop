# Deactivate Bespok3d on a printer

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** the daemon repo (`daemon`), the adapters repo (`adapters`).

**As a** Bespok3d user, **I want** to deactivate Bespok3d on my printer, **so that** I can run the printer in a stock state for troubleshooting or customer support without losing my installed plugins.

See also: [reactivate-bespok3d.md](reactivate-bespok3d.md), [uninstall-bespok3d.md](uninstall-bespok3d.md).

## Acceptance criteria

- [x] Settings → Printers shows a "Deactivate" button for managed printers
- [x] Clicking Deactivate shows a confirmation dialog with an expandable detail section explaining what will happen
- [x] The confirmation dialog has a "Don't show again" checkbox (persisted across sessions)
- [x] After confirming, an SSH credentials form is shown
- [x] The deactivation flow streams progress steps in the same enrollment progress UI
- [x] Steps: daemon deactivates all plugins + SSH removes S90lmd hook
- [x] After deactivation, the app shows the printer as deactivated (`status: 'deactivated'`)
- [x] A banner is shown in the main window when the selected printer is deactivated, with a Reactivate button
- [x] After reboot, the printer boots normally (no plugins, no daemon) and the app still shows it as deactivated
- [x] Settings → Printers shows only a "Reactivate" button for deactivated printers (Deactivate and Uninstall are hidden)

## Notes

All plugin files, the daemon binary, and the workspace directory remain intact. Deactivation is reversible - see [reactivate-bespok3d.md](reactivate-bespok3d.md).
