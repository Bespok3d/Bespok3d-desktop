# Set display language and regional formats

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to choose the app's display language and configure regional formatting, **so that** the interface is in my language and numbers, dates, and units appear in the format I expect.

## Acceptance criteria

- [x] Settings → Language shows all supported locales as a list with a progress ring showing translation completeness
- [x] Selecting a locale switches all UI strings immediately (no restart)
- [x] A "Use system language" toggle auto-detects the OS locale; if the OS locale matches a supported language it is used, otherwise the closest supported locale is used
- [x] The "Currently: {name}" hint shows which language the system is reporting
- [x] Region & Formats section offers: Number formatting (auto from locale or override), Date & time format preview, First day of week (Mon / Sun), Units (Metric / Imperial)
- [x] A "Help translate Bespok3d" link opens a pencil-edit flow for in-app translation contribution; edited strings can be downloaded as JSON
- [x] The selected locale persists across app restarts

## Flags

> 🔲 **UNKNOWN** - The locale preference is held in React state only; it resets to system-detected on each app start. A persisted `preferences.json` or Electron `store` is needed.

> ❓ **UNCLEAR** - The in-app translation editor allows exporting a JSON file, but there is no in-app submit flow. The hint says "send it our way" - what is the actual contribution channel? A GitHub PR, a form, an email? This should be defined and linked.

> ❓ **UNCLEAR** - Region & Formats fields (first day of week, units) are UI controls but do not yet affect any rendered values. Number formatting, date previews, and unit conversions in plugin metadata (e.g., temperature thresholds) are not wired.
