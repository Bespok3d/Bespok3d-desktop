# No flash of wrong UI state

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** every settings panel to show a loading indicator while it fetches data, **so that** I never see the wrong UI state (empty list, disconnected screen, disabled controls) for even a fraction of a second before the real content appears.

## Acceptance criteria

- [x] Opening any settings panel that loads async data shows a centered spinner until the data is ready
- [x] The spinner never gives way to a wrong intermediate state - it transitions directly to the correct final state
- [x] Navigation between panels is instant (no spinner if data is already in memory from a previous load)
- [x] On slow connections the spinner stays visible the whole time data is loading - the panel never flickers

## Implementation rule

The shared pattern is panel loading: show the spinner first and never render a wrong state on the way to the right one. Every panel uses the same one.

Every async data hook exposes `loaded: boolean`. The panel renders `<PanelSpinner />` until `loaded` is `true`.
