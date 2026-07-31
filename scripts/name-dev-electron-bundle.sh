#!/bin/sh
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Make the macOS menu bar read "Bespok3d Dev" instead of "Electron" during `npm run dev`.
#
# macOS takes the application-menu title from the running bundle's CFBundleName, not from
# app.setName() and not from the menu template. A packaged build already gets it right (electron-
# builder writes productName into the bundle it makes); a dev run boots node_modules' stock
# Electron.app, whose bundle is still called Electron. This renames that dev-only bundle.
#
# The "Dev" suffix is the point, not an accident: it matches app.setName() in src/main/index.ts, so
# a dev window is told apart from an installed release at a glance, in the menu bar and in the
# profile and keychain item the dev run keeps to itself.
#
# Editing Info.plist breaks the bundle's ad-hoc signature, so the bundle is re-sealed afterwards.
# Re-sealing gives the bundle a new code identity, so the FIRST dev run after this asks once for the
# "Bespok3d Dev Safe Storage" keychain item that earlier dev runs made; Always Allow settles it.
# The change is local to node_modules and any `npm install` of electron undoes it; `predev` reapplies
# it. Nothing here touches a packaged build.
#
# Never fatal: dev must start even when this cannot run. Non-macOS, a missing bundle and a failed
# tool are all "leave it as it was" and exit 0.

set -e

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
DEV_BUNDLE="$REPO_ROOT/node_modules/electron/dist/Electron.app"
PLIST="$DEV_BUNDLE/Contents/Info.plist"

[ "$(uname)" = "Darwin" ] || exit 0
[ -f "$PLIST" ] || exit 0
command -v plutil >/dev/null 2>&1 || exit 0

# The packaged build's name plus the dev marker, matching app.setName() in src/main/index.ts.
BUNDLE_NAME="$(jq -r '.build.productName' "$REPO_ROOT/package.json") Dev"

CURRENT=$(plutil -extract CFBundleName raw "$PLIST" 2>/dev/null || echo '')
if [ "$CURRENT" = "$BUNDLE_NAME" ]; then
  exit 0
fi

plutil -replace CFBundleName -string "$BUNDLE_NAME" "$PLIST"
plutil -replace CFBundleDisplayName -string "$BUNDLE_NAME" "$PLIST"
codesign --force --sign - "$DEV_BUNDLE" >/dev/null 2>&1 || true

echo "dev Electron bundle named \"$BUNDLE_NAME\" (macOS menu bar)"
