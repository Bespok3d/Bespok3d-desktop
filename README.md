# Bespok3d Desktop

Release host for the **Bespok3d** desktop app, the printer-agnostic plugin manager for Klipper
printers that works on stock firmware. Look mom, custom printer and no SSH.

There is no source code in this repo for now. It exists to host the built installers and the
auto-update metadata. The app is built elsewhere and published here, to the
[Releases](../../releases) page.

## Install (testers)

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

## Notes

- This repo is private. Testers need to be granted access to see the releases.
- Alpha builds are published as GitHub prereleases.
