# Install a plugin on a printer

**Owner:** the daemon repo (`daemon`).

**Also touches:** the app repo (`Bespok3d-desktop`), the adapters repo (`adapters`).

**As a** Bespok3d user, **I want** to install a plugin on my printer with one click, **so that** I can add capabilities without SSHing in or writing config by hand.

See also: [browse-plugins.md](browse-plugins.md) (catalog browsing is a separate story), [view-plugin-detail.md](view-plugin-detail.md) (plugin detail panel).

## Acceptance criteria

- [x] The main app view shows a browsable/searchable plugin catalog - see [browse-plugins.md](browse-plugins.md)
- [x] Each plugin entry shows: name, description, publisher identity tier, install count, version - see [browse-plugins.md](browse-plugins.md)
- [x] Clicking a plugin shows its detail panel - see [view-plugin-detail.md](view-plugin-detail.md)
- [ ] Clicking "Install" on a compatible plugin installs it to the selected printer
- [ ] Installation: daemon downloads the `.b3p` bundle, verifies the GPG signature, unpacks to the printer's plugin directory, applies Klipper config, restarts relevant services
- [ ] Install success/failure is shown in the app
- [ ] Installed plugins are listed per-printer with their version

## Flags

> 🔲 **UNKNOWN** - The install flow is not implemented. The Install button exists in the UI but is disabled with a "coming in the next update" tooltip. The daemon-side install route (`/packages/install`) is missing.

> 🔲 **UNKNOWN** - The catalog data source is not fully implemented. The app ships a bundled in-memory list. The signed-list decision specifies federated signed lists; the mechanism to fetch, cache, and merge multiple external sources is not built.

> 🔲 **UNKNOWN** - Adapter compatibility filtering is not designed. A plugin for the Snapmaker U1 should not be installable on an Ender 3. The `.b3p` format's adapter field (the package-format decision) is defined but the installer's compatibility check is not.

> ❓ **UNCLEAR** - The config-conflict decision covers conflict resolution (two plugins modifying the same Klipper config key). Who is responsible for running conflict resolution - the daemon, the app, or a separate tool? Is it automatic or user-prompted?
