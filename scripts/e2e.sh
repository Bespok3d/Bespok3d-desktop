#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Functional E2E against the PACKAGED app, driven by Playwright-electron (real main/preload/IPC/renderer).
# Needs the app packaged (electron-builder --dir) because only the packaged app resolves adapter paths via
# resources/. Off the default check.sh gate; opt-in via `./scripts/check.sh e2e`. Visual/pixel baselines
# are deferred (see doc/testing.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"

# Unsigned local build; skip code-signing discovery so it does not stall.
export CSC_IDENTITY_AUTO_DISCOVERY=false

# Pack the DEV plugin bundle into dist/plugins so the store-driven specs (screenshots, layout) have a
# catalog offline; `npm run build` runs as a prebuild and would pack the empty RELEASE bundle (the
# canonical fully-online stance), leaving the store empty. So pack dev-mode + build explicitly instead.
# electron-builder --dir is a throwaway test bundle that is never distributed, so disable notarization -
# notarizing an ad-hoc signature fails outright when Apple credentials are present in the environment.
echo "Building + packaging the app (unsigned, --dir, dev plugin bundle, no notarize)..."
( cd "$APP_DIR" \
    && sh "$REPO_ROOT/scripts/pack-plugins.sh" \
    && npx electron-vite build \
    && env -u APPLE_API_KEY -u APPLE_API_ISSUER -u APPLE_API_KEY_ID npx electron-builder --dir -c.mac.notarize=false )

echo "Running the E2E suite..."
npm --prefix "$APP_DIR" run test:e2e
