// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { act, screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import type { B3dOverrides } from '../../../test/b3d-mock'
import { makeT } from '../../../i18n'
import type { PluginConfigField } from '../../../data/types'
import { UrlField } from './url-field'
import { AddressCheckPrinterContext } from './address-check-printer'

const en = makeT('en')

const serverField: PluginConfigField = { key: 'SPOOLMAN_SERVER', label: 'Server', type: 'url', scope: 'global' }

const SELECTED_PRINTER = 'printer-1'

// The address is asked as soon as it stops changing, so a test waits out that pause rather than
// leaving the field: choosing a protocol never leaves it, and that was the whole complaint.
async function afterTypingPause(): Promise<void> {
  await act(async () => { await new Promise((settled) => setTimeout(settled, 700)) })
}

function printerAnswers(httpCode: number | null) {
  return vi.fn().mockResolvedValue({ asked: true, httpCode })
}

// The field as the config form drives it: what is typed and what is picked both come back into it.
function FieldUnderTest({ typed }: { typed: string }) {
  const [address, setAddress] = useState(typed)

  return <UrlField field={serverField} value={address} onChange={setAddress} />
}

function setupForPrinter(field: ReactElement, b3d: B3dOverrides) {
  return setup(
    <AddressCheckPrinterContext.Provider value={SELECTED_PRINTER}>{field}</AddressCheckPrinterContext.Provider>,
    { b3d },
  )
}

function fieldWith(address: string) {
  return <UrlField field={serverField} value={address} onChange={vi.fn()} />
}

describe('UrlField', () => {
  it('keeps a name behind a certificate exactly as typed and asks the printer that whole address', async () => {
    var onChange = vi.fn()
    var askPrinterToReach = printerAnswers(200)
    setupForPrinter(
      <UrlField field={serverField} value="https://spoolman.example.org/" onChange={onChange} />,
      { net: { askPrinterToReach } },
    )

    await afterTypingPause()

    expect(onChange).not.toHaveBeenCalled()
    expect(askPrinterToReach).toHaveBeenCalledWith(SELECTED_PRINTER, 'https://spoolman.example.org/')
  })

  it('tries the address from the printer and never from this computer', async () => {
    var askPrinterToReach = printerAnswers(200)
    var probeService = vi.fn().mockResolvedValue(true)
    var { container } = setupForPrinter(fieldWith('http://192.0.2.50:8000'), { net: { askPrinterToReach, probeService } })

    await afterTypingPause()

    expect(askPrinterToReach).toHaveBeenCalledWith(SELECTED_PRINTER, 'http://192.0.2.50:8000')
    expect(probeService).not.toHaveBeenCalled()
    expect(container.querySelector('.config-reach-ok')?.textContent).toBe(en('store.address_reachable_printer'))
  })

  it('puts the chosen protocol in front of a bare address and moves nothing else', async () => {
    var onChange = vi.fn()
    var { user } = setupForPrinter(
      <UrlField field={serverField} value="192.0.2.50:8000" onChange={onChange} />,
      { net: { askPrinterToReach: printerAnswers(200) } },
    )

    await user.selectOptions(screen.getByRole('combobox'), 'https')

    expect(onChange).toHaveBeenCalledWith('https://192.0.2.50:8000')
  })

  it('asks the address the moment a protocol is picked, without waiting to leave the field', async () => {
    var askPrinterToReach = printerAnswers(200)
    var { user } = setupForPrinter(<FieldUnderTest typed="192.0.2.50:8000" />, { net: { askPrinterToReach } })

    await user.selectOptions(screen.getByRole('combobox'), 'https')
    await afterTypingPause()

    expect(askPrinterToReach).toHaveBeenCalledWith(SELECTED_PRINTER, 'https://192.0.2.50:8000')
  })

  it('asks for a protocol before it goes looking for a bare address', async () => {
    var askPrinterToReach = printerAnswers(200)
    var { container } = setupForPrinter(fieldWith('192.0.2.50:8000'), { net: { askPrinterToReach } })

    await afterTypingPause()

    expect(container.querySelector('.config-error')?.textContent).toBe(en('store.address_pick_scheme'))
    expect(askPrinterToReach).not.toHaveBeenCalled()
  })

  it('warns rather than errors when nothing answers the printer', async () => {
    var { container } = setupForPrinter(fieldWith('http://192.0.2.50:8000'), { net: { askPrinterToReach: printerAnswers(null) } })

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_unreachable_printer'))
    expect(container.querySelector('.config-error')).toBeNull()
  })

  it('says which http code came back to the printer when something is there but not serving that address', async () => {
    var { container } = setupForPrinter(fieldWith('http://192.0.2.50:8000'), { net: { askPrinterToReach: printerAnswers(404) } })

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_http_error_printer', { code: 404 }))
    expect(container.querySelector('.config-error')).toBeNull()
  })

  it('says the printer could not be asked when it gave no answer of its own', async () => {
    var askPrinterToReach = vi.fn().mockResolvedValue({ asked: false })
    var { container } = setupForPrinter(fieldWith('http://192.0.2.50:8000'), { net: { askPrinterToReach } })

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_printer_unasked'))
  })

  it('says the printer could not be asked, and asks nothing, when no managed printer is selected', async () => {
    var askPrinterToReach = printerAnswers(200)
    var { container } = setup(fieldWith('http://192.0.2.50:8000'), { b3d: { net: { askPrinterToReach } } })

    await afterTypingPause()

    expect(container.querySelector('.config-reach-warn')?.textContent).toBe(en('store.address_printer_unasked'))
    expect(askPrinterToReach).not.toHaveBeenCalled()
  })

  it('names an address it cannot read and never goes looking for it', async () => {
    var askPrinterToReach = printerAnswers(200)
    var { container } = setupForPrinter(fieldWith('ftp://spoolman.example.org'), { net: { askPrinterToReach } })

    await afterTypingPause()

    expect(container.querySelector('.config-error')?.textContent).toBe(en('store.address_unusable'))
    expect(askPrinterToReach).not.toHaveBeenCalled()
  })
})
