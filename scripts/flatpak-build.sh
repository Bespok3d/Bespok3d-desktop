#!/usr/bin/env sh
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Build the Linux Flatpak from a machine that is not Linux.
#
# flatpak-builder exists on Linux only, so this runs it inside a Linux container (see
# scripts/flatpak/Dockerfile) against this same working tree. Nothing is rebuilt in there: the
# renderer bundle and the signed plugin payload are the ones the Mac already produced, so the signing
# key never leaves the machine that holds it. The container only assembles them into the .flatpak.
#
# Run it after a normal build; release.sh calls it as part of a cut.
set -eu

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="$(cd "$APP_DIR/.." && pwd)"
IMAGE=bespok3d-flatpak-builder
# The Flatpak is for Linux desktops, which are x86_64; the host being an arm64 Mac does not change
# what the artifact has to run on.
PLATFORM=linux/amd64
# The Linux runtimes this build sits on are installed in the image, but flatpak-builder refreshes them
# from Flathub on every run and deploys a refreshed one by hard-linking it into place. A hard link out
# of the image's own read-only layer is refused ("Invalid cross-device link"), so the first Flathub
# runtime release after the image was built killed the Flatpak stage and the cut lost that download.
# Keeping the runtimes on their own volume gives the refresh somewhere it can actually write.
RUNTIME_VOLUME=bespok3d-flatpak-runtimes
# The runtime version this app builds on is pinned in package.json and installed in the image, but
# electron-builder refreshes it from Flathub before every build and a release cut then depends on
# Flathub being reachable and on whatever it happens to be serving that day. Switching the remote off
# builds against the pinned runtimes only, so the cut is the same offline as online. Moving to a newer
# runtime means editing the pin and the image together, never something a build picks up on its own.
BUILD_COMMAND="npx --no-install electron-builder --linux flatpak --publish never"

command -v docker > /dev/null || {
  echo "Error: the Flatpak needs Docker on this machine (or flatpak-builder on a Linux host)." >&2
  exit 1
}

docker info > /dev/null 2>&1 || {
  echo "Error: Docker is installed but not running. Start Docker Desktop, then run this again." >&2
  exit 1
}

# The Mac's own builds already downloaded every Electron binary, this one included, so the container
# reads that cache instead of pulling 119MB of its own through an emulated network stack that drops
# the connection mid-download.
ELECTRON_CACHE="${ELECTRON_CACHE:-$HOME/Library/Caches/electron}"
mkdir -p "$ELECTRON_CACHE"

[ -f "$APP_DIR/out/main/index.js" ] || {
  echo "Error: no build to package. Run 'npm run build' in $APP_DIR first." >&2
  exit 1
}

echo "Preparing the Flatpak builder image (cached after the first run)..."
docker build --platform "$PLATFORM" -t "$IMAGE" "$APP_DIR/scripts/flatpak"

echo "Building the Flatpak..."
# The whole workspace is mounted because the app packs the daemon and the adapters from sibling
# repos. /dev/fuse and the wider privileges are what flatpak-builder's sandbox needs to assemble a
# build root. The named volume keeps the builder cache out of the working tree and alive between runs.
docker run --rm --platform "$PLATFORM" \
  --privileged --device /dev/fuse \
  -v "$WORKSPACE":/src \
  -v "$ELECTRON_CACHE":/root/.cache/electron \
  -v bespok3d-flatpak-builder:/root/.cache/electron-builder \
  -v "$RUNTIME_VOLUME":/var/lib/flatpak \
  -w /src/Bespok3d-desktop \
  "$IMAGE" \
  sh -c "flatpak remote-modify --disable flathub && $BUILD_COMMAND"

echo "Flatpak written to $APP_DIR/dist/release/"
