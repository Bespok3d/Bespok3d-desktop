// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { DAEMON_DEPLOY_STEP_ID, DAEMON_START_STEP_ID, JINNI_DEPLOY_STEP_ID } from './step-ids'

const U1_ENROLL_STEPS = fileURLToPath(new URL('../../../../adapters/snapmaker-u1/client/enroll-steps/index.ts', import.meta.url))

describe('the adapter steps the app runs by name', () => {
  it.skipIf(!existsSync(U1_ENROLL_STEPS)).each([DAEMON_DEPLOY_STEP_ID, DAEMON_START_STEP_ID, JINNI_DEPLOY_STEP_ID])('include %s, still named so by the U1 adapter', (stepId) => {
    var adapterSteps = readFileSync(U1_ENROLL_STEPS, 'utf-8')

    expect(adapterSteps).toContain(`id: '${stepId}'`)
  })
})
