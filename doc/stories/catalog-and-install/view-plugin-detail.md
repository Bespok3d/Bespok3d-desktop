# View plugin detail

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to open a detail panel for any plugin, **so that** I can understand what it does, what it requires, and what it will change on my printer before I commit to installing it.

## Acceptance criteria

- [x] Clicking any plugin card opens a side panel without navigating away from the catalog
- [x] The panel shows: plugin name, publisher identity tier badge, version, channel, install count
- [x] A long-form description explains what the plugin does
- [x] "Required capabilities" lists what hardware or software the plugin depends on (from the adapter)
- [x] "Configuration" shows any required config fields (key, label, placeholder, hint) the user must supply at install time
- [x] "Requires" lists other plugins this plugin depends on
- [x] "Files & endpoints" lists the files and HTTP endpoints the plugin creates on the printer
- [x] "Permissions" section describes what the plugin is allowed to do on the printer
- [x] An Install (or Manage, if installed) button is shown in the panel footer
- [x] A Close button dismisses the panel; clicking the scrim also closes it
- [x] The panel is scoped to the content area and does not cover the app header

## Flags

> 🔲 **UNKNOWN** - There is no README rendering. The panel shows a static description field from the bundled registry data. Real plugins will have a README.md in their `.b3p` bundle; the panel should render it as markdown once the install flow is live.

> 🔲 **UNKNOWN** - The changelog tab is not designed. Users cannot see what changed between plugin versions from within the app.

> 🔲 **UNKNOWN** - Trust details (publisher fingerprint, GitHub identity link, key publication date) are not shown in the panel. The trust badge is visible but clicking it reveals nothing.
