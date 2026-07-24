// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { PrintersPane } from './printers'
import { PrinterActionsContext } from '../printer-actions'

const en = makeT('en')

function printerHandlers() {
  return {
    onAddPrinter: vi.fn(), onRemovePrinter: vi.fn(), onUpdatePrinterIcon: vi.fn(),
    onEnrollPrinter: vi.fn(), onRepairPrinter: vi.fn(), onRecoverPrinter: vi.fn(), onReinstallPlugins: vi.fn(), onViewEnrollmentLog: vi.fn(), onUpdateDaemon: vi.fn(), onUpdateJinni: vi.fn(),
    onDeactivatePrinter: vi.fn(), onReactivatePrinter: vi.fn(), onUninstallPrinter: vi.fn(),
    onSetCustomSshCredentials: vi.fn(),
  }
}

describe('Empty states', () => {
  it('PrintersPane shows an empty message with no printers', () => {
    setup(
      <PrinterActionsContext.Provider value={printerHandlers()}>
        <PrintersPane printers={[]} adapters={[]} />
      </PrinterActionsContext.Provider>,
    )
    expect(screen.getByText(en('printers.empty'))).toBeInTheDocument()
  })
})
