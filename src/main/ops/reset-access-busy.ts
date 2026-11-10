// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Why a reset of access, or an enrollment, is refused on a printer where another one still runs. Each
// writes its own new token to the printer, so two at once could leave this computer holding the token
// the printer threw away. Kept free of imports because the renderer matches them word for word, to answer
// them in the user's language.
export const RESET_ACCESS_ALREADY_RUNNING = 'A reset of access is already running on this printer'
export const ENROLLMENT_ALREADY_RUNNING = 'An enrollment is running on this printer'
