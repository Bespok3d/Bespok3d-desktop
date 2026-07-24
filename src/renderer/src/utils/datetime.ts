// A date + time stamp in the user's locale (e.g. "Jun 23, 2026, 09:30 AM"), used for enrolled-at and
// daemon-update timestamps. An `undefined` locale follows the OS so the stamp matches the rest of the UI.
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
