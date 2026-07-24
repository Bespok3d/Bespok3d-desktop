// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { makePlugin } from '../../../../test/fixtures'
import { InstallErrorModal } from './InstallErrorModal'
import { PACKAGE_REFUSED_PREFIX } from '../../../../../../main/store/package-refused'
import { malformedPackageMessage } from '../../../../../../main/store/malformed-package'

const plugin = makePlugin({ id: 'webcam-usb', name: 'webcam-usb', title: 'USB Camera' })

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

describe('InstallErrorModal', () => {
  it('names the plugin instead of leaving a literal {name} placeholder', () => {
    setup(<InstallErrorModal plugin={plugin} kind="install" errorMsg="boom" onRetry={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Could not install USB Camera')).toBeInTheDocument()
    expect(screen.queryByText(/\{name\}/)).toBeNull()
  })

  it('uses the remove verb when an uninstall fails, never "Could not install"', () => {
    setup(<InstallErrorModal plugin={plugin} kind="uninstall" errorMsg="boom" onRetry={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Could not remove USB Camera')).toBeInTheDocument()
    expect(screen.queryByText(/Could not install/)).toBeNull()
  })

  it('shows the generic failure with a Technical-details toggle', () => {
    setup(<InstallErrorModal plugin={plugin} kind="install" errorMsg="boom" onRetry={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Technical details')).toBeInTheDocument()
  })

  it('renders a package refusal as tamper-specific copy with the reason as primary text and no toggle', () => {
    const errorMsg = `Error invoking remote method 'store:install': PackageRefusedError: ${PACKAGE_REFUSED_PREFIX}the signature on the package for "webcam-usb" does not check out against any key this app trusts, so it was not installed`
    setup(<InstallErrorModal plugin={plugin} kind="install" errorMsg={errorMsg} onRetry={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('USB Camera was not installed')).toBeInTheDocument()
    expect(screen.getByText(/does not check out against any key this app trusts/)).toBeInTheDocument()
    expect(screen.queryByText('Technical details')).toBeNull()
  })

  it('renders a malformed package as a packaging defect, lists the offending files behind the toggle, and offers no Retry', async () => {
    const offending = 'files/site-packages/foo/__pycache__/bar.cpython-311.pyc'
    const errorMsg = `Error invoking remote method 'store:install': Error: ${malformedPackageMessage('undeclared_member', [offending])}`
    const { user } = setup(<InstallErrorModal plugin={plugin} kind="install" errorMsg={errorMsg} onRetry={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('USB Camera is packaged incorrectly')).toBeInTheDocument()
    expect(screen.queryByText('Retry')).toBeNull()
    await user.click(screen.getByText('Technical details'))
    expect(screen.getByText(new RegExp(escapeRegExp(offending)))).toBeInTheDocument()
  })
})
