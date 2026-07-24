// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, act, fireEvent } from '@testing-library/react'
import { setup } from '../../test/harness'
import { makeT } from '../../i18n'
import { UpdateModal } from './UpdateModal'

const en = makeT('en')

function makeUpdate(overrides: Partial<UpdateAvailablePayload> = {}): UpdateAvailablePayload {
  return { version: '1.2.3', action: 'autoInstall', releaseNotesMarkdown: 'Notes', releaseUrl: 'https://example/releases/v1', ...overrides }
}

interface Handlers {
  onInstall: ReturnType<typeof vi.fn>
  onDownload: ReturnType<typeof vi.fn>
  onOpenDownload: ReturnType<typeof vi.fn>
  onLater: ReturnType<typeof vi.fn>
}

function makeHandlers(): Handlers {
  return { onInstall: vi.fn(), onDownload: vi.fn(), onOpenDownload: vi.fn(), onLater: vi.fn() }
}

function renderModal(props: Partial<React.ComponentProps<typeof UpdateModal>>, handlers: Handlers) {
  return setup(
    <UpdateModal
      update={makeUpdate()}
      progressPercent={null}
      downloaded={false}
      downloadRequested={false}
      errorMessage={null}
      {...handlers}
      {...props}
    />,
  )
}

describe('UpdateModal wiring', () => {
  it('offers Download before the user starts, and the button calls onDownload', async () => {
    var handlers = makeHandlers()
    var { user } = renderModal({}, handlers)
    var button = screen.getByRole('button', { name: en('app_update.download') })
    await user.click(button)
    expect(handlers.onDownload).toHaveBeenCalledOnce()
  })

  it('shows a disabled Downloading button and an indeterminate bar once requested with no percent', () => {
    renderModal({ downloadRequested: true }, makeHandlers())
    expect(screen.getByRole('button', { name: en('app_update.downloading') })).toBeDisabled()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value')
  })

  it('renders a determinate bar once a percentage arrives', () => {
    renderModal({ downloadRequested: true, progressPercent: 42 }, makeHandlers())
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '42')
  })

  it('offers Restart once downloaded, and the button calls onInstall', async () => {
    var handlers = makeHandlers()
    var { user } = renderModal({ downloaded: true }, handlers)
    await user.click(screen.getByRole('button', { name: en('app_update.restart') }))
    expect(handlers.onInstall).toHaveBeenCalledOnce()
  })

  it('falls back to the release page on error, with the error note, and calls onOpenDownload', async () => {
    var handlers = makeHandlers()
    var { user } = renderModal({ downloadRequested: true, errorMessage: 'boom' }, handlers)
    expect(screen.getByText(en('app_update.error', { message: 'boom' }))).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: en('app_update.open_download') }))
    expect(handlers.onOpenDownload).toHaveBeenCalledOnce()
  })

  it('always opens the page on a manual-only platform', () => {
    renderModal({ update: makeUpdate({ action: 'openDownload' }) }, makeHandlers())
    expect(screen.getByRole('button', { name: en('app_update.open_download') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en('app_update.download') })).not.toBeInTheDocument()
  })

  it('dismisses via the Later button', async () => {
    var handlers = makeHandlers()
    var { user } = renderModal({}, handlers)
    await user.click(screen.getByRole('button', { name: en('app_update.later') }))
    expect(handlers.onLater).toHaveBeenCalledOnce()
  })

  // Regression: alpha.27 used a bare onClick on the backdrop, so a press that began inside the modal
  // (selecting notes, a stray click) and released on the backdrop closed the window the instant it
  // appeared. The scrim must only close on a gesture that BOTH starts and ends on the backdrop.
  it('does NOT close when a press starts inside the modal and releases on the backdrop', () => {
    var handlers = makeHandlers()
    var { container } = renderModal({}, handlers)
    var scrim = container.querySelector('.modal-scrim') as HTMLElement
    fireEvent.pointerDown(screen.getByRole('heading'))
    fireEvent.pointerUp(scrim)
    expect(handlers.onLater).not.toHaveBeenCalled()
  })

  // The exact alpha.27 regression: the backdrop used a bare onClick, so a stray click closed the
  // update window the instant it auto-appeared. A click alone must never dismiss now.
  it('does NOT close on a bare click on the backdrop', () => {
    var handlers = makeHandlers()
    var { container } = renderModal({}, handlers)
    fireEvent.click(container.querySelector('.modal-scrim') as HTMLElement)
    expect(handlers.onLater).not.toHaveBeenCalled()
  })

  it('closes only on a genuine backdrop press-and-release', () => {
    var handlers = makeHandlers()
    var { container } = renderModal({}, handlers)
    var scrim = container.querySelector('.modal-scrim') as HTMLElement
    fireEvent.pointerDown(scrim)
    fireEvent.pointerUp(scrim)
    expect(handlers.onLater).toHaveBeenCalledOnce()
  })
})

describe('UpdateModal stall fallback', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('surfaces the open-download fallback after a full-progress stall', () => {
    renderModal({ update: makeUpdate({ action: 'autoInstall' }), downloadRequested: true, progressPercent: 100 }, makeHandlers())
    expect(screen.queryByRole('button', { name: en('app_update.open_download') })).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(20000) })
    expect(screen.getByRole('button', { name: en('app_update.open_download') })).toBeInTheDocument()
    expect(screen.getByText(en('app_update.stalled'))).toBeInTheDocument()
  })
})
