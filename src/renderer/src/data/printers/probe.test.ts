// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { pingAndUpdate } from './probe'
import { makePrinter } from '../../test/fixtures'
import type { Printer } from '../types'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubDaemonAnswer(answer: Record<string, unknown>): void {
  vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue(answer), checkWriteLayer: vi.fn() } })
}

async function statusAfterPing(printer: Printer, answer: Record<string, unknown>): Promise<Printer['status']> {
  var seen: Printer[] = [printer]
  stubDaemonAnswer(answer)
  await pingAndUpdate(printer, (update) => { seen = update(seen) })

  return seen[0].status
}

// The store reads what is on the printer off the printer in memory, and only a ping refreshes it.
// Dropped here, the daemon and the jinni were on the printer and the store never knew: both cards
// offered to install what was already running, and neither ever offered the update the tile announced.
describe('a ping carries what the printer runs of bespok3d itself', () => {
  it('takes the daemon and jinni versions from the answer', async () => {
    var seen: Printer[] = [makePrinter()]
    stubDaemonAnswer({
      isManaged: true, reach: 'managed', sshOpen: true,
      machineryVersions: { 'bespok3d-daemon': '0.12.23', 'bespok3d-jinni-snapmaker-u1': '0.1.10' },
    })

    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })

    expect(seen[0].machineryVersions).toEqual({ 'bespok3d-daemon': '0.12.23', 'bespok3d-jinni-snapmaker-u1': '0.1.10' })
  })

  it('leaves what it knows alone when a daemon too old to report them answers', async () => {
    var seen: Printer[] = [makePrinter({ machineryVersions: { 'bespok3d-daemon': '0.12.22' } })]
    stubDaemonAnswer({ isManaged: true, reach: 'managed', sshOpen: true })

    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })

    expect(seen[0].machineryVersions).toEqual({ 'bespok3d-daemon': '0.12.22' })
  })
})

describe('a ping never puts a switched-off printer back to looking healthy', () => {
  it('shows the printer as deactivated while the printer itself says bespok3d is switched off', async () => {
    const status = await statusAfterPing(makePrinter(), { isManaged: true, reach: 'managed', sshOpen: true, switchedOff: true })
    expect(status).toBe('deactivated')
  })

  it('shows a printer that is switched on as managed again, without waiting for a reactivate', async () => {
    const wasOff = makePrinter({ status: 'deactivated' })
    const status = await statusAfterPing(wasOff, { isManaged: true, reach: 'managed', sshOpen: true, switchedOff: false })
    expect(status).toBe('managed')
  })

  it('reads a daemon too old to answer the question as switched on', async () => {
    const status = await statusAfterPing(makePrinter(), { isManaged: true, reach: 'managed', sshOpen: true })
    expect(status).toBe('managed')
  })
})

// Switching bespok3d off removes the boot hook, so the restart that follows leaves no daemon to answer.
// Reading that silence as a broken daemon offered Repair, Recover and a version update on a printer the
// user had just switched off.
describe('a switched-off printer with no daemon left to answer', () => {
  it('stays switched off instead of looking like a printer whose daemon broke', async () => {
    const switchedOff = makePrinter({ status: 'deactivated', deactivated: true })
    const status = await statusAfterPing(switchedOff, { isManaged: false, reach: 'recoverable', sshOpen: true })
    expect(status).toBe('deactivated')
  })

  it('says offline when the printer answers on nothing at all', async () => {
    const switchedOff = makePrinter({ status: 'deactivated', deactivated: true })
    const status = await statusAfterPing(switchedOff, { isManaged: false, reach: 'offline', sshOpen: false })
    expect(status).toBe('offline')
  })

  it('clears the switched-off note the moment the printer says bespok3d is back on', async () => {
    var seen: Printer[] = [makePrinter({ status: 'deactivated', deactivated: true })]
    stubDaemonAnswer({ isManaged: true, reach: 'managed', sshOpen: true, switchedOff: false })
    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })
    expect(seen[0].deactivated).toBe(false)
  })
})

const DAEMON_GONE_ANSWER = { isManaged: false, holdsDaemonAccess: true, reach: 'recoverable', sshOpen: true }

// A firmware update takes the daemon with it, and after it there is no daemon left to answer, so the
// repair-vs-recover verdict taken before the update was never revisited: the printer was offered a
// daemon repair it cannot survive instead of the full recovery that rebuilds it.
describe('a daemon that was answering and now is not', () => {
  it('drops the verdict taken while it was answering, and asks the printer again', async () => {
    var seen: Printer[] = [makePrinter({
      id: 'printer-after-reflash', status: 'managed', writeLayerIntact: true,
      connection: { reach: 'managed', sshOpen: true }, holdsDaemonAccess: true,
      enrollmentLog: { enrolledAt: '2026-01-01', adapterId: 'snapmaker-u1', steps: [] },
    })]
    const checkWriteLayer = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue(DAEMON_GONE_ANSWER), checkWriteLayer } })

    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })
    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })

    expect(checkWriteLayer).toHaveBeenCalledWith('printer-after-reflash')
    expect(seen[0].writeLayerIntact).toBe(false)
  })
})

// The staging app on a printer the release app enrolled holds the daemon's credentials through an
// access grant and keeps no enrollment log. It was never asked about the write layer, so after a
// firmware update it showed the yellow dot and offered neither a repair nor a recover.
describe('a printer this app reached through an access grant, after a firmware update', () => {
  function grantedPrinter(): Printer {
    return makePrinter({ id: 'printer-granted', status: 'online', connection: { reach: 'recoverable', sshOpen: true }, holdsDaemonAccess: true })
  }

  async function writeLayerAskedAfter(answer: Record<string, unknown>): Promise<ReturnType<typeof vi.fn>> {
    var seen: Printer[] = [grantedPrinter()]
    const checkWriteLayer = vi.fn().mockResolvedValue(false)
    vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue(answer), checkWriteLayer } })
    await pingAndUpdate(seen[0], (update) => { seen = update(seen) })

    return checkWriteLayer
  }

  it('asks the printer whether its write layer survived, with no enrollment log of its own', async () => {
    expect(await writeLayerAskedAfter(DAEMON_GONE_ANSWER)).toHaveBeenCalledWith('printer-granted')
  })

  it('never asks about a printer whose daemon this app holds no access to', async () => {
    expect(await writeLayerAskedAfter({ ...DAEMON_GONE_ANSWER, holdsDaemonAccess: false })).not.toHaveBeenCalled()
  })
})

// The access fact rides on the printer itself, not on its connection, so a probe that could not ask
// main must leave it as loaded rather than wipe it with the connection it rebuilds.
describe('the access fact a probe carries', () => {
  async function afterPing(printer: Printer): Promise<Printer> {
    var seen: Printer[] = [printer]
    await pingAndUpdate(printer, (update) => { seen = update(seen) })

    return seen[0]
  }

  it('takes it from the printer answer', async () => {
    vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockResolvedValue(DAEMON_GONE_ANSWER), checkWriteLayer: vi.fn().mockResolvedValue(null) } })
    expect((await afterPing(makePrinter({ status: 'online' }))).holdsDaemonAccess).toBe(true)
  })

  it('keeps the one the printer was loaded with when main could not be asked', async () => {
    vi.stubGlobal('b3d', { printers: { checkDaemon: vi.fn().mockRejectedValue(new Error('ipc gone')), checkWriteLayer: vi.fn() } })
    expect((await afterPing(makePrinter({ status: 'online', holdsDaemonAccess: true }))).holdsDaemonAccess).toBe(true)
  })
})

// The clock is pinned per answer so a test can say how far apart two polls heard the daemon.
const MANAGED_ANSWER = { isManaged: true, reach: 'managed', sshOpen: true }
const NO_ANSWER = { isManaged: false, reach: 'offline', sshOpen: false, accessState: 'offline' }
const PORT_NOT_UP_ANSWER = { isManaged: false, reach: 'recoverable', sshOpen: true, accessState: 'unrecognized' }
const REFUSING_ANSWER = { isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'credentials-rejected' }
const WAIT_START = Date.now()
const POLL_MS = 15_000

interface TimedAnswer { answer: Record<string, unknown>, at: number }

function onPoll(pollNumber: number, answer: Record<string, unknown>): TimedAnswer {
  return { answer, at: WAIT_START + pollNumber * POLL_MS }
}

// The probe reads the printer as it was when the ping went out; the store may hold a newer one by then.
async function storedAfterAnswer(asProbed: Printer, stored: Printer, timed: TimedAnswer): Promise<Printer> {
  var seen: Printer[] = [stored]
  stubDaemonAnswer(timed.answer)
  vi.spyOn(Date, 'now').mockReturnValue(timed.at)
  await pingAndUpdate(asProbed, (update) => { seen = update(seen) })

  return seen[0]
}

function printerAfterAnswer(printer: Printer, timed: TimedAnswer): Promise<Printer> {
  return storedAfterAnswer(printer, printer, timed)
}

async function waitAfterAnswers(printer: Printer, answers: TimedAnswer[]): Promise<number | undefined> {
  const [timed, ...later] = answers
  if (!timed) return printer.expectedRestartUntil

  return waitAfterAnswers(await printerAfterAnswer(printer, timed), later)
}

function waitingPrinter(id: string): Printer {
  return makePrinter({ id, expectedRestartUntil: WAIT_START + 5 * 60 * 1000, connection: { reach: 'managed', sshOpen: true }, holdsDaemonAccess: true })
}

describe('the wait on a restart we started', () => {
  it('holds on the first answer', async () => {
    const printer = waitingPrinter('printer-first-answer')
    expect(await waitAfterAnswers(printer, [onPoll(0, MANAGED_ANSWER)])).toBe(printer.expectedRestartUntil)
  })

  it('ends when a later poll hears the daemon again', async () => {
    const printer = waitingPrinter('printer-back')
    expect(await waitAfterAnswers(printer, [onPoll(0, MANAGED_ANSWER), onPoll(1, MANAGED_ANSWER)])).toBeUndefined()
  })

  it('holds when the second answer lands right next to the first', async () => {
    const printer = waitingPrinter('printer-double-ping')
    const rightAfter = { answer: MANAGED_ANSWER, at: WAIT_START + 1000 }
    expect(await waitAfterAnswers(printer, [onPoll(0, MANAGED_ANSWER), rightAfter])).toBe(printer.expectedRestartUntil)
  })

  it('starts over when the daemon goes away between answers', async () => {
    const printer = waitingPrinter('printer-went-down')
    const answers = [onPoll(0, MANAGED_ANSWER), onPoll(1, NO_ANSWER), onPoll(2, MANAGED_ANSWER)]
    expect(await waitAfterAnswers(printer, answers)).toBe(printer.expectedRestartUntil)
  })

})

describe('what ends the wait on a restart we started', () => {
  it('counts a daemon that answers but refuses our access', async () => {
    const printer = waitingPrinter('printer-refusing')
    expect(await waitAfterAnswers(printer, [onPoll(0, REFUSING_ANSWER), onPoll(1, REFUSING_ANSWER)])).toBeUndefined()
  })

  it('does not count a daemon port that is not up yet', async () => {
    const printer = waitingPrinter('printer-port-not-up')
    const answers = [onPoll(0, PORT_NOT_UP_ANSWER), onPoll(1, PORT_NOT_UP_ANSWER)]
    expect(await waitAfterAnswers(printer, answers)).toBe(printer.expectedRestartUntil)
  })

  it('starts over on a new wait', async () => {
    const earlier = waitingPrinter('printer-new-wait')
    await waitAfterAnswers(earlier, [onPoll(0, MANAGED_ANSWER)])
    const newWait = { ...earlier, expectedRestartUntil: (earlier.expectedRestartUntil ?? 0) + 1 }
    expect(await waitAfterAnswers(newWait, [onPoll(1, MANAGED_ANSWER)])).toBe(newWait.expectedRestartUntil)
  })

  it('keeps a wait that started while the probe was out', async () => {
    const asProbed = await printerAfterAnswer(waitingPrinter('printer-late-mark'), onPoll(0, MANAGED_ANSWER))
    const startedMeanwhile = { ...asProbed, expectedRestartUntil: (asProbed.expectedRestartUntil ?? 0) + 1 }
    const stored = await storedAfterAnswer(asProbed, startedMeanwhile, onPoll(1, MANAGED_ANSWER))
    expect(stored.expectedRestartUntil).toBe(startedMeanwhile.expectedRestartUntil)
  })
})
