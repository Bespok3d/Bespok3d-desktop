// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, it, expect, vi, afterEach } from 'vitest'

const activationPolicies = vi.hoisted(() => [] as string[])

vi.mock('electron', () => ({
  app: {
    setActivationPolicy: (policy: string) => activationPolicies.push(policy),
  },
}))

import { leaveTheScreenAlone, runsHeadless } from './headless'

const savedHeadless = process.env.B3D_HEADLESS
const savedPlatform = process.platform

function pretendPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform })
}

afterEach(() => {
  if (savedHeadless === undefined) delete process.env.B3D_HEADLESS
  else process.env.B3D_HEADLESS = savedHeadless
  pretendPlatform(savedPlatform)
  activationPolicies.length = 0
})

describe('headless run', () => {
  it('is headless only when B3D_HEADLESS is 1', () => {
    delete process.env.B3D_HEADLESS
    expect(runsHeadless()).toBe(false)
    process.env.B3D_HEADLESS = '1'
    expect(runsHeadless()).toBe(true)
  })

  it('keeps a headless Mac run out of the Dock and the menu bar', () => {
    process.env.B3D_HEADLESS = '1'
    pretendPlatform('darwin')
    leaveTheScreenAlone()
    expect(activationPolicies).toEqual(['accessory'])
  })

  it('leaves a normal run as an ordinary app', () => {
    delete process.env.B3D_HEADLESS
    pretendPlatform('darwin')
    leaveTheScreenAlone()
    expect(activationPolicies).toEqual([])
  })
})
