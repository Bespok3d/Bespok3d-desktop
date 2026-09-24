// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { buildReadme } from './publisherRepo'

describe('publisher README', () => {
  it('links the public key at the normalized fingerprint path', () => {
    const readme = buildReadme([{ label: 'Fixture key', fingerprint: 'ABCD1234', date: '2026-09-23' }])

    expect(readme).toContain('[ABCD1234](keys/abcd1234/key.asc)')
    expect(readme).not.toContain('keys/ABCD1234/')
  })
})
