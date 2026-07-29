# Set a default signing key

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to designate one key as the default, **so that** any purpose or printer with no explicit key assignment automatically uses it.

## Acceptance criteria

- [x] Each key row shows either a "Default" badge or a "Make default" button
- [x] Clicking "Make default" on a key sets it as default and removes the badge from the previously default key
- [x] There is always exactly one default key if any keys exist
- [x] If the default key is deleted and other keys remain, the next key in the list becomes the default automatically
- [x] The default key is persisted across app restarts

## Flags

> ❓ **UNCLEAR** - The fallback priority chain is not fully specified. When a purpose has no assigned key and there is a default key, the default is used. But what if the default key has no identity repo published and the operation requires a published public key? Does it fail silently or show an error?
