# Architecture facts

Read this before you propose a change. It is the short list of constraints the design already
settled, each with the reason it exists, so that a contribution does not spend its first review
round being told it cannot work that way.

Every line is a decision already made and the thinking behind it. If you think one of them is
wrong, that is a conversation worth having, but have it as a conversation, not as a pull request.

The Snapmaker U1 is the reference printer and the source of the concrete examples. Anything marked
as a U1 detail illustrates the idea; it is not a rule for every printer.

## The non-negotiables

Change one of these and the architecture is a different architecture.

| Rule | Why it exists | So you may not |
| --- | --- | --- |
| Stock firmware only | Flashing is a risk the user carries, a firmware build takes minutes, and a build-based system can only be extended by people who can build firmware. Removing all three is why this project exists | Propose anything that needs a custom build, a flash, or a bootloader unlock |
| Everything is idempotent | The manufacturer pushes updates at a time nobody here chooses, and an update wipes the volatile parts of the printer. Recovery is re-running the install, so every step has to be safe to run again | Write a step that only works the first time, or keep anything we own in a location the update wipes |
| Printer-agnostic core | Filesystem layout, service names, init system and hardware all differ by model. Conditionals scattered through core mean nobody can add a printer without editing files they have no business in | Put per-printer knowledge anywhere but an adapter, or hardcode a path anywhere at all |
| Packages are declarative | What a package can cause to happen is exactly what the daemon already exposes and nothing more. That is the security boundary. An install script inside a package would mean an install can do anything | Ship a script inside a package, or add an escape hatch that reaches past the daemon |
| No central server | A central service is a dependency, a single point of failure and a gatekeeping mechanism. All three are things the project exists to avoid | Make anything require the project to host, run or approve a service before a user can install a plugin |
| Identity, not permission | The signing key says who you are. It never says whether you are allowed. Trust tiers communicate identity confidence, not safety and not entitlement | Add a gate that decides who may publish |

## What runs where

| Piece | Where it runs | What it owns |
| --- | --- | --- |
| The app (Electron, TypeScript) | The user's computer | Discovery, enrollment, the catalog, driving install and recovery. The printer keeps working when the app is closed |
| Adapter, client half (TypeScript) | Inside the app | How to connect to one printer model and enroll it over SSH |
| The daemon (Python) | The printer, port 4269 | Every package operation after enrollment. Independent of Klipper and Moonraker on purpose |
| Adapter, device half, the jinni (Python) | The printer, beside the daemon | The printer's real paths, hardware and quirks |
| The index (a signed `index.json`) | Any static host | What packages exist. A list may point at other lists, which is what replaces a central catalog |

The daemon and the jinni split one job in two: the daemon orchestrates and owns the filesystem and
the protocol, the jinni actuates and owns device knowledge. They exchange plain serializable values
over a local socket, never a live object, so the device half can be swapped per printer without the
daemon knowing.

## Two transports, and which one you may use

| Transport | Used for | Used when |
| --- | --- | --- |
| SSH | Deploying the daemon, patching a stock init script so it starts at boot, seeding credentials | Enrollment only. It needs the printer's default password, the one moment that path is open |
| The daemon over HTTP | Install, update, recover, deactivate, teardown | Everything after enrollment |

The daemon does not go through Moonraker, and it never will. Moonraker is part of the Klipper stack
that a bad plugin can break. If the runtime transport ran through it, one broken install would
leave the user with no way back in. A plugin may talk to Moonraker; the Bespok3d layer may never
depend on Moonraker being healthy.

## What an install is made of

| Layer | Declares | Owned by |
| --- | --- | --- |
| The manifest | WHAT, in domain terms: this file is a Klipper extra, this plugin provides a camera service, this one needs Moonraker restarted. Never a real path, never a mechanism | The package author |
| The action vocabulary | The closed, versioned set of verbs a manifest is allowed to use, each one gated by a capability the adapter says it has | Core |
| The adapter | HOW: which real path, link or copy, which restart command | The adapter author |
| The daemon | The only thing that executes any of it | Core |

The manifest never names a path because that is what makes a package portable: the same package
works on a printer whose adapter symlinks files and on one whose adapter copies them, because it
never said which. A verb the adapter does not advertise is refused with a plain "not supported on
this printer" rather than half-applied. Both of those refusals are the design working, not a bug to
route around.

## Boundaries you will trip over

| Boundary | What goes wrong if you cross it |
| --- | --- |
| A plugin's files live in one canonical directory of its own and are linked into place from there | Writing straight to a destination leaves files behind on uninstall, and lets two plugins silently overwrite each other instead of colliding visibly |
| Never commit a static copy of a stock firmware file | Your copy goes stale the day the manufacturer touches that file. Download the live one, patch it (checking first whether it is already patched), upload it back |
| Every deployed file is owned by the printer's default user and is world readable | Klipper reports a permissions failure as "not a valid config section", which reads like a Python import error or a config typo and is neither. It is one of the hardest failures here to diagnose |
| The adapter never reaches into app internals and the app never reaches into an adapter | The adapter stops being replaceable, and replaceable adapters are the entire reason a second printer is cheap to add |
| A plugin's config is split into the portable part and the adapter-specific part | A Spoolman URL is the same on every printer; a camera device path is not. Conflating them breaks the plugin on the next model |
| A shape that crosses the app to daemon boundary is declared once and imported | Two hand-written copies of the same shape drift, and the drift surfaces at runtime in front of a user, not in a test |

## The one invariant behind deactivate, uninstall and recovery

The canonical copy of everything Bespok3d installs lives in Bespok3d's own workspace on the
printer, and that workspace is the source of truth. Everything else Bespok3d puts on the printer is
derived from it and can be rebuilt from it. The user's own files stay in the printer's config
directory and are never ours to wipe.

That is why recovery after a manufacturer update re-applies every plugin from the canonical copy
instead of downloading anything again. How much of the printer is throwaway and how it gets
rebuilt is the adapter's business and differs per model.

*U1 detail: the printer's writable overlay is fully throwaway, so deactivate is a wipe of the
overlay plus a reboot rather than a per-plugin teardown, and uninstall additionally wipes the
workspace. Another printer may not have an overlay at all; its adapter decides.*

Any change that writes outside the workspace and the config directory breaks this, and the wipe
stops being safe.

## Trust, as it actually stands

| Fact | Status |
| --- | --- |
| Each printer generates its own keypair the first time it starts, and the app pins it | Live |
| Adding or revoking an authorized device requires an already-authorized device, so there is no central authority to ask | Live |
| Packages carry a detached signature, and the app verifies it against the pinned project key over the exact bytes it was served | Live |
| A trust tier tells you how confident we are about who published something, never whether it is safe and never whether they were allowed to | Live, by design |
| A list or a package whose signature does not verify still loads, labelled unknown | Live, by design. A signing mistake costs a wrong badge, never a dead store |
| The printer checking signatures for itself | Not on today, and postponed rather than dropped. The app has already verified the signature, and the link from the app to the printer is authenticated at both ends and encrypted, so that last leg rides on a relationship already proven. The immediate reason is room on the printer: where memory is tight, the check does not fit alongside everything else |

## What Bespok3d does not do

| Not our problem | Why |
| --- | --- |
| Remote access | Bring your own VPN. Tunnelling would add a large attack surface for a problem that already has good standalone answers |
| Diagnosing the printer itself | Bespok3d repairs what Bespok3d put there: the autofixers deal with our own install going wrong after a firmware update or a bad state. The printer's own hardware and the manufacturer's firmware are not ours to diagnose |
| Deciding who may publish | The gate is identity, not permission |
| Running a service anyone depends on | See "no central server" above. A user with one printer and a farm with fifty run the same architecture, not two different products |
