// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Why a second reset of access on the same printer is refused while the first still runs. Each reset
// writes its own new token to the printer, so two at once could leave this computer holding the token
// the printer threw away. Kept free of imports because the renderer matches it word for word, to answer
// it in the user's language.
export const RESET_ACCESS_ALREADY_RUNNING = 'A reset of access is already running on this printer'
