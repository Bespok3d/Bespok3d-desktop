# User stories

Every user story Bespok3d has, in one place. This is the only copy: a story lives here
even when the work it asks for happens in the daemon or in an adapter.

Each story follows the same shape:

> As a **[role]**, I want **[action]**, so that **[benefit]**.

Under the title, two lines say which repo has to change for the story to come true:

- **Owner** is the repo that carries the behaviour.
- **Also touches** is every other repo that has to do something for it to work.

The daemon and the adapters keep their own short page listing only the rows that are
theirs: `daemon/doc/story-obligations.md` and `adapters/doc/story-obligations.md`.

## Flags used inside a story

- CONFLICT: contradicts a settled decision or another story, and needs a call before the
  story can be finished.
- UNCLEAR: the requirement is real but the exact behaviour is ambiguous.
- UNKNOWN: out of scope for what is built now, and needs design.

## Progress

The progress column counts the acceptance criteria the story itself ticks off. It is
recomputed from the story files, so it can never drift from them. A ticked criterion is
a claim the story makes about the code, not a test result: the suites in `tests/` and
`e2e/` are what proves behaviour.

## Printer lifecycle

Finding a printer, taking it under management, and handing it back to stock.

| Story | Owner | Also touches | Progress |
| --- | --- | --- | --- |
| [Add a printer](printer-lifecycle/add.md) | adapters | app, daemon | 7 of 9 met |
| [Customize printer appearance](printer-lifecycle/customize.md) | app | nothing else | 4 of 5 met |
| [Deactivate Bespok3d on a printer](printer-lifecycle/deactivate-bespok3d.md) | app | daemon, adapters | all 10 met |
| [Discover a printer](printer-lifecycle/discover.md) | app | adapters, daemon | 4 of 5 met |
| [Printer enrollment status](printer-lifecycle/enroll-status.md) | app | daemon | 5 of 6 met |
| [Reactivate Bespok3d on a printer](printer-lifecycle/reactivate-bespok3d.md) | app | daemon, adapters | all 7 met |
| [Remove a printer](printer-lifecycle/remove.md) | app | nothing else | 3 of 5 met |
| [Uninstall Bespok3d from a printer](printer-lifecycle/uninstall-bespok3d.md) | adapters | app, daemon | all 9 met |

## Catalog and install

Where plugins come from, and what happens when one is installed.

| Story | Owner | Also touches | Progress |
| --- | --- | --- | --- |
| [Browse and discover plugins](catalog-and-install/browse-plugins.md) | app | nothing else | all 11 met |
| [Install a plugin on a printer](catalog-and-install/install-plugin.md) | daemon | app, adapters | 3 of 7 met |
| [Select release channels](catalog-and-install/manage-channels.md) | app | nothing else | 6 of 7 met |
| [Add and remove plugin sources](catalog-and-install/manage-sources.md) | app | nothing else | 3 of 7 met |
| [Require GPG signature verification](catalog-and-install/signature-verification.md) | daemon | app | 3 of 5 met |
| [View plugin detail](catalog-and-install/view-plugin-detail.md) | app | nothing else | all 11 met |

## Identity and trust

Keys, git host accounts, and who a package is believed to come from.

| Story | Owner | Also touches | Progress |
| --- | --- | --- | --- |
| [Assign a key to a purpose](identity-and-trust/assign-key-purpose.md) | app | nothing else | all 8 met |
| [Assign a signing key to a printer](identity-and-trust/assign-key-to-printer.md) | app | daemon | all 5 met |
| [Ban a key](identity-and-trust/ban-key.md) | Bespok3d org | app | 0 of 5 met |
| [Connect a Gitea instance](identity-and-trust/connect-gitea.md) | app | nothing else | all 6 met |
| [Connect a GitHub account](identity-and-trust/connect-github.md) | app | nothing else | all 7 met |
| [Delete a key](identity-and-trust/delete-key.md) | app | nothing else | all 7 met |
| [Generate a GPG key](identity-and-trust/generate-key.md) | app | nothing else | all 6 met |
| [Publish a key to a git host](identity-and-trust/publish-key.md) | app | nothing else | all 9 met |
| [Set a default signing key](identity-and-trust/set-default-key.md) | app | nothing else | all 5 met |
| [Enroll as a verified manufacturer](identity-and-trust/verified-manufacturer.md) | Bespok3d org | app, adapters | 0 of 6 met |

## App shell

The settings the app itself carries, and the two rules every screen obeys.

| Story | Owner | Also touches | Progress |
| --- | --- | --- | --- |
| [Control app appearance](app-shell/app-appearance.md) | app | nothing else | all 7 met |
| [Configure general app settings](app-shell/app-general-settings.md) | app | nothing else | all 6 met |
| [Set display language and regional formats](app-shell/app-language.md) | app | nothing else | all 7 met |
| [Layered messages - plain language with optional technical detail](app-shell/layered-messages.md) | app | nothing else | all 7 met |
| [No flash of wrong UI state](app-shell/no-wrong-flash.md) | app | nothing else | all 4 met |

## Publishing

What someone does to put a plugin or a curated list in front of other people.

| Story | Owner | Also touches | Progress |
| --- | --- | --- | --- |
| [Become a verifiable plugin publisher](publishing/become-publisher.md) | app | nothing else | 0 of 5 met |
| [Create and publish a curated plugin list](publishing/create-list.md) | app | nothing else | 0 of 6 met |
| [Manage plugin and list repositories](publishing/manage-repos.md) | app | nothing else | all 9 met |
| [Publish a plugin](publishing/publish-plugin.md) | app | nothing else | 0 of 6 met |
