// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Some failures arrive in words written for programmers: the U1 adapter's own English refusal, the SSH
// library's, the operating system's. The app answers each one it knows in the owner's language, with
// what happened and what to do. The raw words stay in every report, where they help whoever fixes it.
interface KnownFailure {
  rawWords: RegExp
  messageKey: string
}

const KNOWN_FAILURES: readonly KnownFailure[] = [
  // The U1 adapter refuses an Extended-firmware printer, and the app says why no custom firmware is needed.
  { rawWords: /runs the Extended firmware/, messageKey: 'enroll.refusal.extended_firmware' },
  // The SSH library tried every login it was given and the printer said no to each.
  { rawWords: /All configured authentication methods failed/, messageKey: 'failure.ssh_login_refused' },
  // The SSH library's readyTimeout ran out before the login finished, counted from the connection attempt.
  { rawWords: /Timed out while waiting for handshake/, messageKey: 'failure.ssh_no_handshake' },
  // The operating system gave up opening a connection to the printer's address: nothing answered.
  { rawWords: /\bconnect ETIMEDOUT\b/, messageKey: 'failure.printer_no_answer' },
  // The printer's address answered, but nothing listens on 4269, the Bespok3d daemon's port.
  { rawWords: /\bconnect ECONNREFUSED \S*:4269\b/, messageKey: 'failure.bespok3d_not_running' },
  // The printer's address answered, but nothing listens on 22, the SSH login's port.
  { rawWords: /\bconnect ECONNREFUSED \S*:22\b/, messageKey: 'failure.ssh_refused' },
  // The operating system has a network, but no device at the printer's address answers on it.
  { rawWords: /\bconnect EHOSTUNREACH\b/, messageKey: 'failure.printer_unreachable' },
  // The operating system has no network that leads to the printer's address at all.
  { rawWords: /\bconnect ENETUNREACH\b/, messageKey: 'failure.no_network_to_printer' },
  // A printer added by hand keeps whatever address was typed, and a name that resolves to nothing ends here.
  { rawWords: /\bgetaddrinfo ENOTFOUND\b/, messageKey: 'failure.printer_address_not_found' },
]

// The message key the app shows in place of the raw words, or null when the raw words are all there is.
export function knownFailureKey(rawFailure: string): string | null {
  return KNOWN_FAILURES.find((failure) => failure.rawWords.test(rawFailure))?.messageKey ?? null
}

// The sentence a user reads for a failure: the app's own when it knows the failure, the raw words when not.
export function failureInUserWords(rawFailure: string, translate: (messageKey: string) => string): string {
  const messageKey = knownFailureKey(rawFailure)

  return messageKey ? translate(messageKey) : rawFailure
}
