# Customize printer appearance

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to set an icon and color for each printer in my list, **so that** I can tell them apart at a glance when I have multiple machines.

## Acceptance criteria

- [x] Each printer row shows an editable icon area
- [x] Clicking the icon opens a picker that supports: accent color, custom image upload, and icon zoom/size
- [x] Changes are saved immediately (no explicit save button)
- [x] The icon persists across app restarts
- [ ] The printer's display name (nick) is also editable inline - ❓ editable in the add flow; inline editing in the printer row not yet built

## Flags

> ❓ **UNCLEAR** - The printer nickname is editable in the UI but it is stored locally only. If another device in the same household manages the same printer, their nicknames are not synchronized. Is the name a local-only preference or should it be persisted on the printer/daemon? The key-lifecycle decision does not address this.
