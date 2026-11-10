// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The ports a printer is reached on. Kept free of imports on purpose: the renderer reads them too, to
// name a refused connection by the service that refused it.

// Where the Bespok3d daemon on a printer listens.
export const DAEMON_PORT = 4269

// Where a printer's SSH login listens unless its owner set it up on another port.
export const STANDARD_SSH_PORT = 22
