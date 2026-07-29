# Reactivate Bespok3d on a printer

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** the daemon repo (`daemon`), the adapters repo (`adapters`).

**As a** Bespok3d user, **I want** to reactivate Bespok3d after deactivation, **so that** my plugins are restored without re-enrolling or reinstalling anything.

See also: [deactivate-bespok3d.md](deactivate-bespok3d.md).

## Acceptance criteria

- [x] Settings → Printers shows a "Reactivate" button for deactivated printers
- [x] The main-window DeactivatedBanner also has a Reactivate button
- [x] Clicking Reactivate opens an SSH credentials form
- [x] The reactivation flow streams progress steps in the enrollment progress UI
- [x] Steps: remove deactivated marker, restore printer.cfg include (SAVE_CONFIG-aware), restore moonraker.conf include, restore S90lmd boot hook, start daemon, verify daemon, recover plugins
- [x] After reactivation, `POST /packages/recover` is called and plugins are re-applied in dependency order
- [x] The app updates the printer to `status: 'managed'` and removes the DeactivatedBanner

## Notes

Reactivation works entirely over SSH - the daemon is not running at the start of the flow. The include line is inserted above the `#*# <--- SAVE_CONFIG` boundary if one exists, matching the enrollment behavior (the enrollment decision).
