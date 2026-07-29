# Printer enrollment status

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** the daemon repo (`daemon`).

**As a** Bespok3d user, **I want** the app to correctly reflect whether my printer has the bespok3d daemon running, **so that** I know at a glance whether the full feature set is available without having to SSH in or restart the app.

## Acceptance criteria

- [x] After successful enrollment the printer shows `managed` status immediately
- [x] `managed` status is persisted to disk and restored when the app is restarted - re-opening the app does not show a previously enrolled printer as `online` or `checking`
- [x] The ping loop checks daemon health (TCP connect port 4269) for enrolled printers and sets `managed` if the daemon responds, `online` if it does not
- [x] For non-enrolled printers the ping loop uses `resolvedStatus` (falls back to `managed` if `installedIds` is non-empty, otherwise `online`)
- [x] A printer that is unreachable shows `offline` regardless of enrollment state
- [ ] The UI surfaces the distinction between "daemon not running" and "daemon never installed" - 🔲 requires separate status value or UI treatment

## Implementation notes

`pingAndUpdate` (`data/printers.ts`) checks `printer.enrollmentLog` as the signal that the daemon was deployed. If set, it calls `window.b3d.printers.checkDaemon(ip)` (TCP probe, 3s timeout) to resolve the status. On app load, `hooks/printers.ts:loadSavedPrinters` preserves `status === 'managed'` from disk and stamps all others as `'checking'`, immediately triggering a ping for each.

## Flags

> ❓ **UNCLEAR** - After a factory reset, the printer's daemon is gone but the app record still has `enrollmentLog` set. The TCP probe correctly detects the daemon as absent and shows `online`, but the user needs to re-enroll manually. There is no automated detection of "this printer was reset."
