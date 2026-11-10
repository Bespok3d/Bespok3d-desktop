// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect } from 'vitest'
import { runEnrollmentAlone, runRequestAlone } from './token-write-lock'
import { ENROLLMENT_ALREADY_RUNNING } from './reset-access-busy'

// A token write the test ends when it chooses, so another one can be tried while it still runs.
function heldTokenWrite() {
  const gate = { end: () => undefined as void }
  const running = new Promise<void>((resolve) => { gate.end = resolve })

  return { gate, write: () => running }
}

describe('an access request and an enrollment on one printer', () => {
  it('refuses an access request while an enrollment runs, so the enrollment\'s token is the one kept', async () => {
    const enrollment = heldTokenWrite()
    const enrolling = runEnrollmentAlone('printer-1', enrollment.write)

    await expect(runRequestAlone('printer-1', async () => 'request token stored')).rejects.toThrow(ENROLLMENT_ALREADY_RUNNING)
    enrollment.gate.end()
    await enrolling
  })

  it('starts an enrollment only once a running access request has stored its token', async () => {
    const request = heldTokenWrite()
    const storeOrder: string[] = []
    const requesting = runRequestAlone('printer-2', () => request.write().then(() => { storeOrder.push('request') }))
    const enrolling = runEnrollmentAlone('printer-2', async () => { storeOrder.push('enrollment') })

    await Promise.resolve()
    expect(storeOrder).toEqual([])
    request.gate.end()
    await Promise.all([requesting, enrolling])
    expect(storeOrder).toEqual(['request', 'enrollment'])
  })
})
