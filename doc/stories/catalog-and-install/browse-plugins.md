# Browse and discover plugins

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to browse, search, and filter the plugin catalog, **so that** I can find plugins that match my printer and preferences without scrolling through everything.

## Acceptance criteria

- [x] The main app view shows a plugin catalog when at least one printer is configured
- [x] A search field filters plugins by name, identifier, and tagline in real time
- [x] Filter chips narrow the list to: All, Printer-specific only, Installed, Updates available
- [x] Trust filter chips narrow by publisher tier: All, Any, Community, Project, Manufacturer
- [x] Category chips narrow to a single category (All, Camera, Filament, Screen); selecting a category collapses the category section headers
- [x] When "All" categories and "Group by category" are active, plugins are shown in labeled sections per category with a subtitle
- [x] A grouping toggle switches between grouped (sections) and flat mixed view; in flat view each card shows its category badge
- [x] Grid / list layout toggle: grid uses auto-fill columns; list uses full-width horizontal rows
- [x] Grid density follows the Density setting in Settings → General (Compact 200 px / Comfortable 260 px / Spacious 320 px columns)
- [x] Each plugin card shows: icon (category-colored), name, publisher trust badge, version, channel pill (if not stable), install count, tagline, Install or Manage button
- [x] Installed plugins are visually distinguished (Installed pill on the card)

## Flags

> ❓ **UNCLEAR** - The "Updates" filter chip is rendered but always returns zero results because the app has no mechanism to detect that a newer version of an installed plugin is available. Version comparison against a remote source is not implemented.

> ❓ **UNCLEAR** - The "Printer" filter chip narrows to `printerSpecific: true` plugins. Plugins that are not printer-specific but are only meaningful with a printer are excluded. Is `printerSpecific` the right field for this distinction, or should there be a `requiresPrinter` flag separate from "hardware-specific"?

> 🔲 **UNKNOWN** - The catalog is currently a bundled in-memory list. Fetching live data from external sources, caching it, and merging multiple signed lists (the signed-list decision) is not implemented. The UI is ready for an expanded catalog but the data layer is not.
