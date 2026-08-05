// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The daemon and the device driver beside it are deployed as one pair, by one enrollment. A build that
// pairs them wrongly puts a daemon on the printer that asks the driver for something the driver has no
// answer for, and every operation from then on ends in the same refusal. The printer is not broken and
// nothing on it needs unpicking: re-enrolling replaces both halves with a matched pair.
const DRIVER_LACKS_WHAT_DAEMON_ASKED = /object has no attribute/i
const DRIVER_DOES_NOT_KNOW_THE_WORD = /unknown verb:/i

export function daemonDriverMismatch(reason: string): boolean {
  return DRIVER_LACKS_WHAT_DAEMON_ASKED.test(reason) || DRIVER_DOES_NOT_KNOW_THE_WORD.test(reason)
}

// Some refusals the printer writes for a person to read: a print in progress names the services the
// batch would have restarted, and that sentence belongs on screen. The rest is machinery talking to
// machinery, which reads as a fault in Bespok3d itself to anyone who cannot parse it, so it is put
// where a user can still fetch it and quote it without meeting it first.
const A_TRANSPORT_STATUS_AND_ITS_BODY = /^daemon \d{3}: /
const A_PYTHON_EXCEPTION_NAME = /\b\w*Error\b/
const A_SOCKET_FAILURE = /\bE[A-Z]{4,}\b/

export function writtenForMachines(reason: string): boolean {
  return A_TRANSPORT_STATUS_AND_ITS_BODY.test(reason)
    || A_PYTHON_EXCEPTION_NAME.test(reason)
    || A_SOCKET_FAILURE.test(reason)
}
