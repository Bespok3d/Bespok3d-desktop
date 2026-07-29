# Manage plugin and list repositories

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to tell the app which of my git repos contain plugins and which contain lists, **so that** the app knows where to publish packages and the purpose chips on my keys become active.

## Acceptance criteria

- [x] Settings → Git Host shows two sections: "Plugin repositories" and "List repositories"
- [x] Each section lists configured repos as `owner/repo` rows with a remove button
- [x] An "Add repository" control appears at the bottom of each section
- [x] Clicking "Add repository" expands an input field with autocomplete suggestions from the user's repos on the connected git host
- [x] The user can type `owner/repo` directly or select from the dropdown
- [x] Clicking "Add" validates the repo exists and saves it; clicking away or pressing Escape cancels
- [x] Removing a repo removes it from the list; no data in the repo is deleted
- [x] Multiple repos can be added to each section independently
- [x] Changes in this pane immediately affect the purpose chips in Settings → Keys (no stale data)

## Flags

> 🔲 **UNKNOWN** - When a user has multiple plugin repos, the app does not know which one to use when publishing a new package version. The "Packages" purpose chip assigns a key to `*` (any) or a specific repo, but the publish flow (which repo gets the GitHub release?) is not designed. The release-distribution decision describes releasing to GitHub releases but assumes one target repo.

> ❓ **UNCLEAR** - Can the same repo appear in both "Plugin repositories" and "List repositories"? The data model allows it (two separate arrays). Is a monorepo scenario (one repo containing both a plugin and a list) intentional?

> ❓ **UNCLEAR** - Repo verification happens at settings load time (removes repos that no longer exist on the git host). This means a repo temporarily unavailable (API rate limit, network issue) may be silently removed from the configured list. Is that the right behavior, or should the app keep the entry and show a warning?

> 🔲 **UNKNOWN** - There is no story for creating a plugin repo from scratch within the Git Host pane. The current UI lets you add existing repos; creating a new `bespok3d-plugin-myplugin` repo is done via the key publish flyout (which creates the identity repo) or manually on GitHub/Gitea.
