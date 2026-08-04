# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# The Linux Flatpak builder, so a Mac can cut one. flatpak-builder exists only on Linux, and every
# release so far is cut on macOS, which left the Flatpak to a Linux host nobody has. This image is
# that host: x86_64 (what Linux desktops run, and what the Electron payload inside the Flatpak is),
# carrying flatpak-builder plus the three flatpak refs the build assembles the app on top of.
#
# Built and run by scripts/flatpak-build.sh; not published anywhere.
FROM --platform=linux/amd64 node:20-bookworm

# elfutils carries eu-strip, which flatpak-builder shells out to; without it the build dies late.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        flatpak flatpak-builder elfutils ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/*

# flatpak reports a ref it could not install as a warning and still exits 0, so the three the build
# actually stands on are checked here: a missing one fails the image now instead of a packaging run
# twenty minutes later.
RUN flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo \
    && flatpak install -y --noninteractive flathub \
        org.freedesktop.Platform//24.08 \
        org.freedesktop.Sdk//24.08 \
        org.electronjs.Electron2.BaseApp//24.08 \
    && for ref in runtime/org.freedesktop.Platform/x86_64/24.08 \
                  runtime/org.freedesktop.Sdk/x86_64/24.08 \
                  app/org.electronjs.Electron2.BaseApp/x86_64/24.08; do \
           flatpak info "$ref" > /dev/null || exit 1; \
       done

WORKDIR /src
