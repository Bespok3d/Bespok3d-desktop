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

command -v docker > /dev/null || {
  echo "Error: the Flatpak needs Docker on this machine (or flatpak-builder on a Linux host)." >&2
  exit 1
}

[ -f "$APP_DIR/out/main/index.js" ] || {
  echo "Error: no build to package. Run 'npm run build' in $APP_DIR first." >&2
  exit 1
}

echo "Preparing the Flatpak builder image (cached after the first run)..."
docker build --platform "$PLATFORM" -t "$IMAGE" "$APP_DIR/scripts/flatpak"

echo "Building the Flatpak..."
# The whole workspace is mounted because the app packs the daemon and the adapters from sibling
# repos. /dev/fuse and the wider privileges are what flatpak-builder's sandbox needs to assemble a
# build root. The two named volumes keep the electron download and the builder cache out of the
# working tree and alive between runs.
docker run --rm --platform "$PLATFORM" \
  --privileged --device /dev/fuse \
  -v "$WORKSPACE":/src \
  -v bespok3d-flatpak-electron:/root/.cache/electron \
  -v bespok3d-flatpak-builder:/root/.cache/electron-builder \
  -w /src/Bespok3d-desktop \
  "$IMAGE" \
  npx --no-install electron-builder --linux flatpak --publish never

echo "Flatpak written to $APP_DIR/dist/release/"
