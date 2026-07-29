#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Generate plain-artifact screenshots of the real packaged app into repo-root/screenshots (and, by hand,
# into the wiki). Builds + packages arm64-only (fast, no Intel), then runs only the screenshots spec.
# Not part of check.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"

# Unsigned local build; skip code-signing discovery so it does not stall.
export CSC_IDENTITY_AUTO_DISCOVERY=false

echo "Building + packaging the app (unsigned, --dir, arm64)..."
( cd "$APP_DIR" && npm run build && npx electron-builder --dir --arm64 )

echo "Capturing app + store screenshots..."
( cd "$APP_DIR" && npx playwright test e2e/screenshots.spec.ts )

# Onboarding shots drive the real app against the in-vitro Docker device (real SSH enroll). Needs Docker
# and a free host port 22 (turn macOS Remote Login off). Skipped cleanly when Docker is unavailable.
if docker info > /dev/null 2>&1; then
    echo "Capturing onboarding screenshots (in-vitro device)..."
    docker build -t bespok3d/fake-printer-base:latest "$APP_DIR/tests/invitro"
    ( cd "$APP_DIR" && npx playwright test e2e/onboarding.spec.ts )
else
    echo "Docker not running; skipping onboarding screenshots."
fi

echo "Screenshots written to $REPO_ROOT/../screenshots"
