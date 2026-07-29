# Add and remove plugin sources

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to subscribe to third-party plugin sources in addition to the official Bespok3d catalog, **so that** I can install community plugins from curators I trust.

## Acceptance criteria

- [x] Settings → Repositories → Plugin Sources lists all configured sources; the official Bespok3d source is always present and cannot be removed
- [x] Each source row shows: name, URL (or "bundled"), plugin count, locked status, and a "Set primary" option for non-locked sources
- [x] An "Add source" button is visible; custom plugin sources are noted as coming in a future update
- [ ] Clicking "Add source" opens an input accepting a URL pointing to a signed `index.json`
- [ ] The app fetches the URL, verifies the GPG signature, and adds the source if valid
- [ ] Invalid URLs or signature failures show a clear error message
- [ ] Removing a non-locked source removes it from the list and hides plugins that came only from that source

## Flags

> 🔲 **UNKNOWN** - The "Add source" flow is not implemented. The button is present but clicking it shows a hint ("coming in a future update") and does nothing.

> 🔲 **UNKNOWN** - The `index.json` schema is not finalized (see also `publish-plugin.md`, `create-list.md`). Until the schema is fixed, fetching and parsing third-party sources is impossible.

> ❓ **UNCLEAR** - When a plugin appears in multiple sources, which version wins? The signed-list decision says "highest-trust source wins" but if two community-tier sources both list the same plugin at different versions, the tie-break is undefined.

> ❓ **UNCLEAR** - The "Set primary" action is rendered per source but its meaning is not defined in any settled decision. Does it affect which source is checked first for updates? Or which source's metadata (description, icon) is used when two sources describe the same plugin?
