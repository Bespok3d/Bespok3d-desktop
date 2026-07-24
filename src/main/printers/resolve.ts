import { checkDaemon, checkSshOpen } from './probe'
import { loadPrinters, updatePrinter } from './store'
import { candidateAddresses } from './address'
import { liveSightings } from '../mdns/sightings'

// A candidate address is live when the daemon (4269) or SSH (22) answers there: both are the printer's
// own ports, so an answer means the printer really is at that address right now (not a stale lease).
async function addressAnswers(ip: string): Promise<boolean> {
  const [daemon, ssh] = await Promise.all([checkDaemon(ip), checkSshOpen(ip)])

  return daemon || ssh
}

// Pick the live address from the ordered candidates, preferring the first (the recorded IP) so a stable
// printer never thrashes; falls through to the first moved address that answers.
async function pickLiveAddress(candidates: string[]): Promise<string | null> {
  const answered = await Promise.all(candidates.map(addressAnswers))
  const liveIndex = answered.findIndex(Boolean)

  return liveIndex >= 0 ? candidates[liveIndex] : null
}

// The address a printer answers on RIGHT NOW, found by probing its recorded IP plus every fresh
// discovery sighting of the same device and using whichever responds. Persists the change so every
// later op and ping targets it. This is what makes an op (update-jinni, repair, ...) connect to the
// printer at its current lease instead of a stale recorded IP when the lease has moved or is
// flip-flopping. Returns the recorded IP unchanged when nothing answers, so the caller still has an
// address to try and a clear failure to report.
export async function resolveLiveAddress(printerId: string): Promise<string> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record) return ''
  const candidates = candidateAddresses(record, liveSightings(), Date.now())
  const live = candidates.length > 1 ? await pickLiveAddress(candidates) : null
  if (live && live !== record.ip) updatePrinter(printerId, { ip: live })

  return live ?? record.ip
}

// Every address this printer is known to answer on right now: its recorded IP plus every fresh
// discovery sighting of the same device. Surfaced in the dropdown's "Also reachable at" line so a
// flip-flopping DHCP lease is visible to the user (both .66 and .109) instead of a confusing mystery.
// One entry (just the recorded IP) means a stable printer, so the line stays hidden.
export function knownAddresses(printerId: string): Array<{ ip: string }> {
  const record = loadPrinters().find((rec) => rec.id === printerId)
  if (!record) return []

  return candidateAddresses(record, liveSightings(), Date.now()).map((ip) => ({ ip }))
}
