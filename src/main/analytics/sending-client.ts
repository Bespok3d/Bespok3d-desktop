// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What kind of copy of Bespok3d sent an event, and what it is running on. Three properties, attached
// by the sender to every event, so no call site can restate them or disagree about them.
//
// None of them tells two machines apart. A platform word, a language tag and the word desktop are
// each shared by an enormous number of installs, which is what keeps them counts of the population
// rather than a description of a person.
import { loadSettings } from '../settings'

// The kind of Bespok3d that sent this. One word today, because there is one app. A phone app would
// send its own word from its own code, and the numbers would separate without either side changing.
const CLIENT_KIND = 'desktop'

// The platform names Node uses are not the names people use, and a raw process.platform would put
// darwin and win32 in front of a reader. Anything not on this list is reported as its own raw name
// rather than dropped or guessed at, so a platform we never anticipated still counts as something.
const OS_NAMES: Record<string, string> = { darwin: 'macos', win32: 'windows', linux: 'linux' }

export interface SendingClient {
  client: string
  os: string
  language: string
}

// systemLanguage is what the machine is set to, read once at start. The setting wins when the user
// has chosen a language of their own, and it is read fresh on every event so a change of language
// lands in the numbers inside the same run.
export function sendingClientProperties(systemLanguage: string): SendingClient {
  return {
    client: CLIENT_KIND,
    os: OS_NAMES[process.platform] ?? process.platform,
    language: loadSettings().uiLocale ?? systemLanguage,
  }
}
