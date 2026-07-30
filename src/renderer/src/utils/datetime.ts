// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How long ago something was, as hh:mm. Used for the age of the plugin list, which is stated in the
// refresh offer an install puts up.
export function formatElapsedHoursMinutes(elapsedMs: number): string {
  const minutes = Math.max(0, Math.round(elapsedMs / 60_000))
  const hours = Math.floor(minutes / 60)

  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// A date + time stamp in the user's locale (e.g. "Jun 23, 2026, 09:30 AM"), used for enrolled-at and
// daemon-update timestamps. An `undefined` locale follows the OS so the stamp matches the rest of the UI.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
