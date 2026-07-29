# Control app appearance

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to set the app's theme and layout density, **so that** it matches my OS preferences and fits my screen comfortably.

## Acceptance criteria

- [x] Settings → Appearance shows a Theme section with three options: Light, Dark, System
- [x] Selecting System tracks the OS dark-mode preference automatically; switching OS theme updates the app without restarting
- [x] The header toolbar icon also toggles between light and dark on the fly (skips System)
- [x] The selected theme persists across app restarts
- [x] Settings → General shows a Grid Layout → Density section with three options: Compact, Comfortable, Spacious
- [x] Density changes the plugin grid's minimum column width (Compact 200 px, Comfortable 260 px, Spacious 320 px)
- [x] Density preference persists across app restarts

## Flags

> ❓ **UNCLEAR** - Density only affects the plugin grid. Should it also affect Settings list rows, printer list rows, or other list-like components? A global density token would allow one setting to cascade everywhere.

> 🔲 **UNKNOWN** - There is no persistence layer for these preferences. They are held in React state and reset to defaults on every app start. A `preferences.json` or Electron `store` is needed for persistence.
