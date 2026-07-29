# Assign a key to a purpose

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to assign different keys to different purposes (packages, lists, contribution, printers), **so that** I can use separate identities for publishing, contributing, and authenticating to printers.

## Purposes

| Purpose | Meaning |
|---|---|
| Packages | Key used to sign plugin packages I publish |
| Lists | Key used to sign plugin lists I maintain |
| Contribution | Key used when I contribute to others' repos (PRs, issues, etc.) |
| Printers | Key used to authenticate to a specific printer's daemon |

## Acceptance criteria

- [x] Each key row shows four purpose chips: Packages, Lists, Contribution, Printers
- [x] A chip is inactive (grey) if there are no valid entities for that purpose (no repos configured, no printers added)
- [x] Clicking an active chip with a single valid entity toggles the assignment on/off
- [x] Clicking an active chip with multiple entities opens a dropdown to select one; "Any repository" is always the first option
- [x] Selecting "Any repository" (`*`) means this key is the fallback for that purpose across all repos
- [x] Selecting a specific entity means this key is used only when that exact entity is involved
- [x] Two keys cannot be assigned to the same `{purpose, entity}` pair - assigning key B to what key A had removes it from key A
- [x] Assignments are saved immediately; the chip label updates to show the assigned entity

## Flags

> ❓ **UNCLEAR** - "Contribution" purpose meaning is ambiguous. Contributing could mean: (a) contributing code to plugin repos, (b) contributing to the Bespok3d project itself, (c) signing PRs or issue comments somehow. The contribution key is shown in the UI but its use at signing time is not defined.

> ❓ **UNCLEAR** - Priority resolution at signing time: if key A is assigned `{contribution, *}` (any repo) and key B is assigned `{contribution, owner/repo}` (a specific repo), which key is used when signing a contribution to `owner/repo`? The UI supports both states simultaneously but the resolver is not implemented.

> ❓ **UNCLEAR** - "Any repository" (`*`) for the Packages purpose means "use this key when publishing to any plugin repo." But a publisher may have multiple plugin repos. Does this mean all of them, or "whichever repo the app decides to publish to"? The meaning of `*` at publish time needs to be codified.

> 🔲 **UNKNOWN** - The Contribution purpose chips show all user repos (not just plugin/list repos). The intent is "use this key when I contribute to any of my repos." However, the mechanism for actually using the key (signing git commits? signing some Bespok3d artifact?) is not defined.
