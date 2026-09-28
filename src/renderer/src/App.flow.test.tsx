// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, act, waitFor } from '@testing-library/react'
import { setup } from './test/harness'
import { makeEnrollEvent } from './test/fixtures'
import { makeT } from './i18n'
import type { PrinterRecord } from '../../main/printers'
import { showsUnreleasedFeatures } from './utils/unreleased-features'
import App from './App'

const en = makeT('en')

vi.mock('./utils/unreleased-features', () => ({ showsUnreleasedFeatures: vi.fn(() => true) }))

// App's useDisplayPrefs reads prefers-color-scheme; jsdom has no matchMedia, so stub it before render.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never
  vi.mocked(showsUnreleasedFeatures).mockReturnValue(true)
})

const enrolledRecord = {
  id: 'printer-1', nick: 'Alpha', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
  host: 'alpha.local', ip: '10.0.0.1', status: 'online', installedIds: ['spoolman'],
  enrollmentLog: { enrolledAt: '2026-01-01', adapterId: 'snapmaker-u1', steps: [] },
  daemonToken: 'T', daemonCert: 'C',
} as unknown as PrinterRecord

// A printer that answers "the daemon is not there" is not graded on that one answer: the app probes
// again a moment later and only then puts a banner up, so these waits outlast that confirming probe.
const AFTER_THE_CONFIRMING_PROBE = { timeout: 3000 }

function renderApp(printersOverride: Record<string, unknown>, records: PrinterRecord[] = [enrolledRecord], accessOverride: Partial<Window['b3d']['access']> = {}) {
  return setup(<App />, { b3d: { printers: { load: vi.fn().mockResolvedValue(records), ...printersOverride }, access: accessOverride } })
}

function freshAccessFixture(id: string): PrinterRecord {
  return { id, nick: 'Fixture U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1', host: 'fixture.local', ip: '192.0.2.23', status: 'online', installedIds: [] } as unknown as PrinterRecord
}

describe('App flow: a known enrolled printer whose daemon went down (groups 2-4)', () => {
  it.each([
    { clientContext: 'same-machine fresh profile', printerId: 'fixture-printer', ip: '192.0.2.23' },
    { clientContext: 'other-machine client', printerId: 'fixture-printer-remote', ip: '192.0.2.24' },
  ])('routes a $clientContext through request and grant without SSH enrollment', async ({ printerId, ip }) => {
    const freshProfilePrinter = {
      id: printerId, nick: 'Fixture U1', model: 'Snapmaker U1', adapter: 'snapmaker-u1',
      host: 'fixture.local', ip, status: 'online', installedIds: [],
    } as unknown as PrinterRecord
    var accessStatus = vi.fn().mockResolvedValueOnce('pending').mockResolvedValueOnce('granted')
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'present-awaiting-access', ip, networkInterfaces: [] }),
    }, [freshProfilePrinter], { request: vi.fn().mockResolvedValue({ ok: true }), status: accessStatus })
    await user.click(await screen.findByRole('button', { name: en('banner.access_action') }))
    await user.click(screen.getByRole('button', { name: en('access.choice.steps_only') }))

    expect(await screen.findByText(en('access.waiting.title'))).toBeInTheDocument()
    await waitFor(() => expect(accessStatus).toHaveBeenCalledWith(printerId), { timeout: 3500 })
    await waitFor(() => expect(screen.getByText(en('access.granted.title'))).toBeInTheDocument(), { timeout: 6000 })
    expect(b3d.access.request).toHaveBeenCalledWith(printerId, '')
    await user.click(screen.getByRole('button', { name: en('access.done') }))
    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  }, 10000)
})

describe('App flow: requests never fall through to enrollment', () => {
  it('reopens a saved printer with rejected credentials into the access request path', async () => {
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'credentials-rejected', ip: '192.0.2.30', networkInterfaces: [] }),
    })
    await user.click(await screen.findByRole('button', { name: en('banner.access_action') }))
    await user.click(screen.getByRole('button', { name: en('access.choice.steps_only') }))

    expect(await screen.findByText(en('access.waiting.title'))).toBeInTheDocument()
    expect(b3d.access.request).toHaveBeenCalledWith('printer-1', '')
    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  })

  it('shows an unrecognized service diagnosis without a dead access action', async () => {
    var { b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'unrecognized', ip: '10.0.0.1', networkInterfaces: [] }),
    })
    expect(await screen.findByText(en('banner.access_unrecognized', { name: enrolledRecord.nick }))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('banner.access_action') })).not.toBeInTheDocument()

    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  })

  it('adds a fresh printer directly to access request instead of SSH enrollment', async () => {
    const checkDaemon = vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'present-awaiting-access', ip: '192.0.2.25', networkInterfaces: [] })
    var { user, b3d } = renderApp({ checkDaemon }, [])
    await user.click(screen.getByRole('button', { name: en('header.add_printer') }))
    await user.click(screen.getByRole('button', { name: en('add.tab_manual') }))
    await user.type(screen.getByPlaceholderText(en('add.ip_placeholder')), '192.0.2.25')
    await user.type(screen.getByPlaceholderText(en('add.nick_placeholder')), 'Fixture U1')
    await user.click(screen.getByRole('button', { name: en('add.submit') }))

    expect(await screen.findByRole('heading', { name: en('access.request.title', { name: 'Fixture U1' }) })).toBeInTheDocument()
    const addedPrinter = vi.mocked(b3d.printers.save).mock.calls[0][0]
    expect(checkDaemon).toHaveBeenCalledWith(addedPrinter.id)
    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  })

  it('routes the Settings Enroll action for a fresh record to access request', async () => {
    const settingsPrinter = freshAccessFixture('fixture-settings-enroll')
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'present-awaiting-access', ip: '192.0.2.23', networkInterfaces: [] }),
    }, [settingsPrinter])
    await user.click(screen.getByRole('button', { name: en('header.settings') }))
    await user.click(screen.getByRole('button', { name: en('set.printers') }))
    await user.click(await screen.findByRole('button', { name: en('printers.enroll') }, AFTER_THE_CONFIRMING_PROBE))

    expect(await screen.findByRole('heading', { name: en('access.request.title', { name: settingsPrinter.nick }) })).toBeInTheDocument()
    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  })

  it('keeps explicit enrollment available when the daemon is confirmed absent', async () => {
    const settingsPrinter = freshAccessFixture('fixture-absent-daemon')
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true, accessState: 'daemon-absent', ip: settingsPrinter.ip, networkInterfaces: [] }),
    }, [settingsPrinter])
    await user.click(screen.getByRole('button', { name: en('header.settings') }))
    await user.click(screen.getByRole('button', { name: en('set.printers') }))
    await user.click(await screen.findByRole('button', { name: en('printers.enroll') }, AFTER_THE_CONFIRMING_PROBE))

    expect(await screen.findByRole('heading', { name: 'Enroll Fixture U1' })).toBeInTheDocument()
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith(settingsPrinter.id, settingsPrinter.ip, settingsPrinter.adapter, 'root', '', 22, undefined, false))
  })
})

describe('App flow: canceled access and re-enrollment choices', () => {
  it('canceling a pending access request does not enroll or probe SSH', async () => {
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'present-awaiting-access', ip: '192.0.2.23', networkInterfaces: [] }),
    }, [freshAccessFixture('fixture-cancelled')], { request: vi.fn().mockResolvedValue({ ok: true }) })
    await user.click(await screen.findByRole('button', { name: en('banner.access_action') }))
    await user.click(screen.getByRole('button', { name: en('access.choice.steps_only') }))
    await screen.findByText(en('access.waiting.title'))
    await user.click(screen.getByRole('button', { name: en('access.cancel') }))

    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
  })

  it('canceling the warned re-enroll path leaves the saved printer untouched', async () => {
    const staleAccessRecord = { ...freshAccessFixture('fixture-stale-client'), accessIdentity: 'fixture-client-identity' }
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'identity-changed', ip: '192.0.2.23', networkInterfaces: [] }),
    }, [staleAccessRecord])
    await user.click(await screen.findByRole('button', { name: en('banner.access_action') }))
    await user.click(screen.getByRole('button', { name: en('access.reenroll.action') }))
    expect(await screen.findByText(en('access.reenroll.summary'))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('btn.cancel') }))

    expect(b3d.printers.enroll).not.toHaveBeenCalled()
    expect(b3d.printers.checkSshOpen).not.toHaveBeenCalled()
    expect(b3d.access.request).not.toHaveBeenCalled()
  })

  it('re-enrolls only after the destructive warning is confirmed', async () => {
    const staleAccessRecord = { ...freshAccessFixture('fixture-confirmed-reenroll'), accessIdentity: 'fixture-client-identity' }
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'alive-no-ssh', sshOpen: false, accessState: 'identity-changed', ip: staleAccessRecord.ip, networkInterfaces: [] }),
    }, [staleAccessRecord])
    await user.click(await screen.findByRole('button', { name: en('banner.access_action') }))
    await user.click(screen.getByRole('button', { name: en('access.reenroll.action') }))
    expect(await screen.findByText(en('access.reenroll.summary'))).toBeInTheDocument()
    expect(b3d.printers.enroll).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: en('access.reenroll.confirm') }))

    expect(await screen.findByRole('heading', { name: 'Enroll Fixture U1' })).toBeInTheDocument()
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith(staleAccessRecord.id, staleAccessRecord.ip, staleAccessRecord.adapter, 'root', '', 22, undefined, false))
  })

  it('a write-layer-intact printer offers Repair, and clicking it runs the daemon repair', async () => {
    var repair = vi.fn().mockResolvedValue(undefined)
    var { user } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true }),
      checkWriteLayer: vi.fn().mockResolvedValue(true),
      repair,
    })
    await user.click(await screen.findByRole('button', { name: en('banner.repair_action') }, AFTER_THE_CONFIRMING_PROBE))

    // The banner opens the window; nothing runs on the printer until the user says go on it.
    expect(repair).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole('button', { name: 'Repair daemon' })[1])
    // Not forced: only the Force menu waives the refusal to put a printer back onto an older daemon.
    await waitFor(() => expect(repair).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22, false))
  })

  it('a post-OTA printer (write layer reset) offers Recover, not Repair, and Recover starts the re-enroll', async () => {
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true }),
      checkWriteLayer: vi.fn().mockResolvedValue(false),
    })
    await screen.findByRole('button', { name: en('banner.recover_action') }, AFTER_THE_CONFIRMING_PROBE)
    expect(screen.queryByRole('button', { name: en('banner.repair_action') })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('banner.recover_action') }))
    expect(await screen.findByRole('heading', { name: /Recover Alpha/ })).toBeInTheDocument()
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22, undefined, false))
  })

  it('finishing the recovery re-enroll triggers a plugin recover (store.recover)', async () => {
    var recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    var { user, emit, b3d } = setup(<App />, {
      b3d: {
        store: { recover },
        printers: {
          load: vi.fn().mockResolvedValue([enrolledRecord]),
          checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true }),
          checkWriteLayer: vi.fn().mockResolvedValue(false),
        },
      },
    })
    await user.click(await screen.findByRole('button', { name: en('banner.recover_action') }, AFTER_THE_CONFIRMING_PROBE))
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalled())

    act(() => emit.enrollProgress(makeEnrollEvent({ status: 'done', stepLabel: 'Finished', stepIndex: 13, totalSteps: 14 })))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1'))
  })
})

describe('App flow: a managed printer whose plugin state drifted (group 5)', () => {
  it('shows the drift banner and recovers plugins on click', async () => {
    var recover = vi.fn().mockResolvedValue({ ok: true, results: [] })
    var managedRecord = { ...enrolledRecord, status: 'managed' } as unknown as PrinterRecord
    var { user } = setup(<App />, {
      b3d: { store: { recover }, printers: {
        load: vi.fn().mockResolvedValue([managedRecord]),
        checkDaemon: vi.fn().mockResolvedValue({ isManaged: true, reach: 'managed', sshOpen: true, daemonDrift: [{ pluginId: 'spoolman', symlinkIssueCount: 2 }] }),
      } },
    })
    await user.click(await screen.findByRole('button', { name: en('banner.drift_action') }))
    await waitFor(() => expect(recover).toHaveBeenCalledWith('printer-1'))
  })
})

// A repair the user forced can discover mid-run that the printer needs full recovery instead. Handing
// that recovery over unforced walks him straight back into the refusal he forced his way past, and no
// rendered test sees it, because the escalation is wired where the modal is mounted.
describe('App flow: a forced repair that escalates to recovery', () => {
  it('hands the recovery the same forced flag the repair was launched with', () => {
    var wiring = readFileSync('src/renderer/src/app/AppModals.tsx', 'utf8')

    expect(wiring).toContain('onEscalateRecovery={() => actions.handleRecoverPrinter(enrollModal.printer.id, enrollModal.forced)}')
  })

  it('rebuilds the printer forced, since the recovery it follows has already failed', () => {
    var wiring = readFileSync('src/renderer/src/app/AppModals.tsx', 'utf8')

    expect(wiring).toContain('onRebuildPrinter={() => actions.handleEnrollPrinter(enrollModal.printer.id, true)}')
  })
})

describe('App: the tabs a released build shows', () => {
  it('a dev run offers the Create tab next to the Store one', async () => {
    renderApp({})
    expect(await screen.findByRole('button', { name: new RegExp(en('mode.create')) })).toBeInTheDocument()
  })

  it('a released build shows no tab strip at all, since only the Store is left', async () => {
    vi.mocked(showsUnreleasedFeatures).mockReturnValue(false)
    renderApp({})
    await screen.findByText('Alpha')
    expect(screen.queryByRole('button', { name: new RegExp(en('mode.create')) })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(en('mode.store')) })).not.toBeInTheDocument()
  })
})
