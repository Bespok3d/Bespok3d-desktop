# Select release channels

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to choose which release channels I receive plugin updates from, **so that** I can balance stability against early access to new features.

## Channels

| Channel | Cadence | Default |
|---|---|---|
| LTS | Quarterly | on |
| Stable | Bi-weekly | on |
| RC | Weekly | off |
| Testing | Daily | off |
| Experiment | Ad-hoc | off |

## Acceptance criteria

- [x] Settings → Repositories → Release Channels shows all five channels with a toggle per channel
- [x] Each channel shows its label, description, and cadence
- [x] LTS and Stable are on by default; RC, Testing, and Experiment are off by default
- [x] Enabling a channel makes plugins from that channel appear in the catalog
- [x] Disabling a channel hides plugins that are only available on that channel; plugins also available on an enabled channel remain visible
- [x] Channel pills on plugin cards show the channel name for non-stable plugins
- [ ] Channel preferences are persisted across app restarts

## Flags

> 🔲 **UNKNOWN** - Channel toggles are rendered in the UI but have no effect on the catalog. The filter logic to show/hide plugins based on active channels is not wired to the channel preference state.

> 🔲 **UNKNOWN** - Channel preferences are not persisted. A `preferences.json` or Electron `store` is needed.

> ❓ **UNCLEAR** - If a plugin has only an Experiment version, and the user enables Experiment, should the plugin appear with a strong warning ("expect breakage")? Or is the channel pill on the card sufficient? The current card design shows a channel pill but no additional warning.
