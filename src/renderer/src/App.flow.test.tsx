// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
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

function renderApp(printersOverride: Record<string, unknown>) {
  return setup(<App />, { b3d: { printers: { load: vi.fn().mockResolvedValue([enrolledRecord]), ...printersOverride } } })
}

describe('App flow: a known enrolled printer whose daemon went down (groups 2-4)', () => {
  it('a write-layer-intact printer offers Repair, and clicking it runs the daemon repair', async () => {
    var repair = vi.fn().mockResolvedValue(undefined)
    var { user } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true }),
      checkWriteLayer: vi.fn().mockResolvedValue(true),
      repair,
    })
    await user.click(await screen.findByRole('button', { name: en('banner.repair_action') }))
    await waitFor(() => expect(repair).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'root', '', 22))
  })

  it('a post-OTA printer (write layer reset) offers Recover, not Repair, and Recover starts the re-enroll', async () => {
    var { user, b3d } = renderApp({
      checkDaemon: vi.fn().mockResolvedValue({ isManaged: false, reach: 'recoverable', sshOpen: true }),
      checkWriteLayer: vi.fn().mockResolvedValue(false),
    })
    await screen.findByRole('button', { name: en('banner.recover_action') })
    expect(screen.queryByRole('button', { name: en('banner.repair_action') })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: en('banner.recover_action') }))
    expect(await screen.findByRole('heading', { name: /Recover Alpha/ })).toBeInTheDocument()
    await waitFor(() => expect(b3d.printers.enroll).toHaveBeenCalledWith('printer-1', '10.0.0.1', 'snapmaker-u1', 'root', '', 22))
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
    await user.click(await screen.findByRole('button', { name: en('banner.recover_action') }))
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
