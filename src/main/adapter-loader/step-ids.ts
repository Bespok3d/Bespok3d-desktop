// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The adapter steps the app runs by name, outside an adapter's own enrollment order. Every adapter
// names its steps this way, so these ids are part of the contract between the app and an adapter.

// Puts the daemon and the adapter's jinni on the printer.
export const DAEMON_DEPLOY_STEP_ID = 'deploy-daemon'

// Starts, or restarts, the daemon on the printer.
export const DAEMON_START_STEP_ID = 'start-daemon'

// Puts only the adapter's jinni on the printer.
export const JINNI_DEPLOY_STEP_ID = 'deploy-jinni'

// Installs the packages of the daemon already on the printer, from the files that daemon brought.
export const DAEMON_VENV_REFRESH_STEP_ID = 'refresh-daemon-venv'
