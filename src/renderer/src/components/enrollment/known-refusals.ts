// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The U1 adapter refuses an Extended-firmware printer in English, with a sentence of its own. The app
// answers it instead, in the owner's language, and says why no custom firmware is needed at all.
const EXTENDED_FIRMWARE_REFUSAL = 'runs the Extended firmware'

// The message key the app shows in place of a step's own words, or null to show the step's words.
export function refusalMessageKey(stepError: string): string | null {
  if (stepError.includes(EXTENDED_FIRMWARE_REFUSAL)) return 'enroll.refusal.extended_firmware'

  return null
}
