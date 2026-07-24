// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../test/harness'
import { makeT } from '../../../i18n'
import { BugReportModal } from './BugReportModal'

const en = makeT('en')

function renderModal(overrides: Partial<Parameters<typeof BugReportModal>[0]> = {}) {
  return setup(
    <BugReportModal
      title="It broke"
      subtitle="A subtitle"
      guidance="Some guidance"
      tech="RAW DAEMON ERROR"
      actions={<button>Retry</button>}
      onClose={vi.fn()}
      {...overrides}
    />,
  )
}

describe('BugReportModal', () => {
  it('renders the headline copy and the caller actions, hiding the raw tech until asked', () => {
    renderModal()
    expect(screen.getByText('It broke')).toBeInTheDocument()
    expect(screen.getByText('A subtitle')).toBeInTheDocument()
    expect(screen.getByText('Some guidance')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('RAW DAEMON ERROR')).not.toBeInTheDocument()
  })

  it('reveals and hides the raw tech behind the shared Technical-details toggle', async () => {
    var { user } = renderModal()
    await user.click(screen.getByRole('button', { name: en('report.show_tech') }))
    expect(screen.getByText('RAW DAEMON ERROR')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('report.hide_tech') }))
    expect(screen.queryByText('RAW DAEMON ERROR')).not.toBeInTheDocument()
  })

  it('renders an optional callout above the guidance', () => {
    renderModal({ callout: <div data-testid="callout">heads up</div> })
    expect(screen.getByTestId('callout')).toBeInTheDocument()
  })

  it('owns the Close button and reports a dismiss', async () => {
    var onClose = vi.fn()
    var { user } = renderModal({ onClose })
    await user.click(screen.getByRole('button', { name: en('btn.close') }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
