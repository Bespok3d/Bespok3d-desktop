# Configure general app settings

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to set my startup preferences and privacy options, **so that** the app opens in the state I use most and I control what data it sends.

## Acceptance criteria

- [x] Settings → General shows a Startup section with a "Default printer" dropdown listing all configured printers
- [x] Selecting a default printer means the app opens with that printer's plugin view selected
- [x] A "None" option means the app starts with no printer selected (shows the catalog without printer context)
- [x] A "Show installed-only by default" toggle makes the app open with the Installed filter active instead of All
- [x] Settings → General shows a Privacy section with a "Send anonymous usage data" toggle; it is off by default
- [x] All general settings persist across app restarts

## Flags

> 🔲 **UNKNOWN** - None of these settings are persisted. They are held in React state and reset to defaults on every app start. A `preferences.json` or Electron `store` is needed.

> ❓ **UNCLEAR** - The telemetry toggle says "off by default - we have to write our own analytics anyway." No analytics backend or event schema is designed. Turning the toggle on currently has no effect.

> ❓ **UNCLEAR** - "Show installed-only by default" is defined at the app level. Should this be per-printer (one printer for testing, another for production), or is one global default enough?
