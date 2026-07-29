// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { DeviceList } from './DeviceList'
import type { DiscoveredPrinterRecord } from '../../../env'

const en = makeT('en')

function printer(host: string, ip: string): DiscoveredPrinterRecord {
  return { id: `${host}-${ip}`, host, ip, model: 'Snapmaker U1', vendor: 'Snapmaker', service: '_klipper._tcp' }
}

function gadget(host: string, ip: string): DiscoveredPrinterRecord {
  return { id: `${host}-${ip}`, host, ip, model: 'Network device', vendor: 'Unknown', service: '_http._tcp' }
}

describe('DeviceList show-all count', () => {
  it('counts deduped devices in the show-all label, not raw discovery emits', () => {
    const discovered = [
      printer('u1.local', '10.0.0.5'),
      printer('u1.local', 'fe80::1'),
      gadget('thing.local', '10.0.0.9'),
    ]
    setup(
      <DeviceList discovered={discovered} scanning={false} isAlreadyAdded={() => false} onPick={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: en('add.show_all_devices', { total: 2, hidden: 1 }) }),
    ).toBeInTheDocument()
  })
})
