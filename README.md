# Bespok3d Desktop

[![licence](https://img.shields.io/badge/licence-AGPL--3.0-blue)](LICENSE)
[![release](https://img.shields.io/github/v/release/Bespok3d/Bespok3d-desktop)](https://github.com/Bespok3d/Bespok3d-desktop/releases)
[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FBespok3d%2FBespok3d-desktop%2Fmain%2Fpackage.json&query=%24.version&label=version&color=blue)](package.json)
![built with](https://img.shields.io/badge/built%20with-Electron%20and%20React-informational)
![stock firmware](https://img.shields.io/badge/stock%20firmware-no%20flashing-brightgreen)

The **Bespok3d** desktop app: the printer-agnostic plugin manager for Klipper printers that works on
stock firmware. Look mom, custom printer and no SSH.

This repo holds the app source and hosts its built installers, so the app auto-updates from its own
[Releases](../../releases) page.

## This is a beta

The base system is built and it works: enrolment, the plugin format, the on-printer daemon, the
registry, packaging and signing are all in place and running on real printers. We are opening as a
beta out of caution, not because something is missing.

What that caution means in practice: the protocols, the conventions and the definitions are settled
and documented, but they may still be refined as real printers and real users tell us things we
cannot learn from our own bench. If evidence says a decision was wrong, we would rather change it
during the beta than live with it afterwards. Where a change would break something you already have
installed, migrating you is our job, not yours.

Versions are plain semantic versioning. `beta` is a label on the whole line and is never counted,
so releases run `0.7.0-beta`, `0.7.1-beta`, `0.8.0-beta` and so on. The label comes off at 1.0,
which is when we stop reserving the right to change our minds.

## Install

Grab the latest from [Releases](../../releases):

- **macOS:** the `-arm64` `.dmg`, for any Mac with Apple Silicon (2020 onward). Signed and notarized.
- **Windows:** the `Setup` `.exe`.
- **Linux:** the `.AppImage`.

There is also an `-x64` macOS `.dmg` for Intel Macs. It is offered, not supported: Apple is winding
Rosetta down, the app is tested only on Apple Silicon, and a problem that appears only on the Intel
build is not one we chase. If you have an Apple Silicon Mac, take the `-arm64` build even though the
Intel one will run.

Open the app and connect your GitHub account once (Settings, Git Host). That is what lets you
install plugins and lets the app fetch its own updates from this private repo.

## Updates

The app updates itself from this repo's Releases:

- **Windows / Linux:** updates install automatically. Settings, Update lets you choose how often it
  checks and when to apply (on next quit, or restart now).
- **macOS:** signed builds auto-install; if a build is ever unsigned the app instead points you at
  the download page.

The first install is delivered out of band (you download it here once). Every release after that is
offered to you inside the app.

## Develop

Electron main/preload/renderer, React + TypeScript, built with electron-vite.

```sh
npm install
npm run dev          # the app against a live daemon
npm run catalog      # the Ladle component catalog, no printer needed
./scripts/check.sh   # the gate: vitest, eslint, tsc, knip, ratchet, conventions
```

`./scripts/check.sh` defaults to the smart gate (the always-on floor plus whatever changed vs HEAD).
`./scripts/check.sh full` runs every block and is what CI runs; add `e2e` for the packaged-app
Playwright suite.

| Path                                                     | What it holds                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/main`, `src/preload`, `src/renderer`                | the three Electron processes                                                                 |
| `tests/`, `e2e/`                                         | the invitro suites and the packaged-app Playwright suite                                     |
| `scripts/`                                               | the gate, the release cut, the bundle builder                                                |
| `tools/`                                                 | the engineering-health ratchet and its detectors                                             |
| `CLAUDE.md`, `AGENTS.md`                                 | the rules any AI assistant working here must follow                                          |
| [`doc/architecture-facts.md`](doc/architecture-facts.md) | how the system is put together, and why it is put together that way                          |
| [`doc/roadmap.md`](doc/roadmap.md)                       | where the project is, what its thinking has settled, and what it is built to grow into       |
| [`doc/for-manufacturers.md`](doc/for-manufacturers.md)   | what a printer manufacturer can do with Bespok3d, and the architecture that carries each one |
| [`doc/stories/`](doc/stories/README.md)                  | every user story the project has, the only copy of each, with the repo that owns it          |

### Checking out on its own

This repo builds and tests standalone. Two things reach outside it, and both come from sibling
repos in the same workspace:

- **`lib_bespok3d`**, the shared contract types (`@bespok3d/contract`). The one intentional common
  dependency across every Bespok3d repo.
- **The payloads a packaged build bakes in**: the daemon, the printer adapters, and the plugin
  packages. You need those siblings only to package an installer, never to develop or to run the
  gate.

## Notes

- This repo is private. Testers need to be granted access to see the releases.
- A build is a beta because its version says `beta`, not because of how it was published. The app's
  updater reads the version; GitHub's prerelease flag only decides what the releases page calls Latest.

## Licence

Copyright (C) 2026 unlucio and the Bespok3d contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU
Affero General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If
not, see <https://www.gnu.org/licenses/>. The full text is in [LICENSE](LICENSE).

Bespok3d is a project of the Bespok3d Organisation, which is not a legal entity. Copyright is held by
the individual authors named above.

## Support this project

Bespok3d is built and maintained in the open, on stock printer firmware. If it saved you an
afternoon, you can [buy me a coffee](https://buymeacoffee.com/unlucio).
