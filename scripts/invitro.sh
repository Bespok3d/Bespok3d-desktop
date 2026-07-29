#!/usr/bin/env bash
# SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# In-vitro integration suite: real app code driven against a Docker fake device. Requires Docker.
# Not part of check.sh (the fast gate); run this on demand or in a dedicated CI job.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT"

if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Start Docker and retry." >&2
    exit 1
fi

echo "Building the fake-printer base image..."
docker build -t bespok3d/fake-printer-base:latest "$APP_DIR/tests/invitro"

echo "Running the in-vitro suite..."
npm --prefix "$APP_DIR" run test:invitro
