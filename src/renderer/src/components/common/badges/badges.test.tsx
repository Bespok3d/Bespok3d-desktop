// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { I18nProvider } from '../../../i18n/context'
import { realI18nValue } from '../../../test/harness'
import { TrustPill } from './TrustPill'
import { StatusPill } from './StatusPill'
import { ChannelPill } from './ChannelPill'

function renderPill(node: React.ReactNode) {
  return render(<I18nProvider value={realI18nValue()}>{node}</I18nProvider>)
}

describe('TrustPill', () => {
  it('renders the short trust label with the tier class and a shield icon', () => {
    const { container } = renderPill(<TrustPill trust="project" icon />)
    const pill = container.querySelector('span.trust')
    expect(pill).not.toBeNull()
    expect(pill).toHaveClass('project')
    expect(pill?.textContent).toContain('Project')
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders the full label when full is set and no icon by default', () => {
    const { container } = renderPill(<TrustPill trust="project" full />)
    expect(container.querySelector('span.trust')?.textContent).toContain('Bespok3d project')
    expect(container.querySelector('svg')).toBeNull()
  })

  it('uses the question-mark shield for an unknown publisher and honors title', () => {
    const { container } = renderPill(<TrustPill trust="any" icon title="any" />)
    expect(container.querySelector('span.trust')).toHaveClass('any')
    expect(container.querySelector('span.trust')).toHaveAttribute('title', 'any')
  })
})

describe('StatusPill', () => {
  it('renders the status-pill class and the localized status label', () => {
    const { container } = renderPill(<StatusPill status="installed" />)
    const pill = container.querySelector('span.status-pill')
    expect(pill).toHaveClass('installed')
    expect(pill?.textContent).toBe('Installed')
  })
})

describe('ChannelPill', () => {
  it('renders a toned channel pill with the localized channel label', () => {
    const { container } = renderPill(<ChannelPill channel="experiment" />)
    const pill = container.querySelector('span.chan-pill')
    expect(pill).toHaveClass('compact')
    expect(pill).toHaveAttribute('data-tone', 'experiment')
    expect(pill?.textContent).toBe('Experiment')
    expect(pill).not.toHaveClass('installed-chan')
  })

  it('marks the installed channel and applies the title', () => {
    const { container } = renderPill(<ChannelPill channel="rc" installed title="on the printer" />)
    const pill = container.querySelector('span.chan-pill')
    expect(pill).toHaveClass('installed-chan')
    expect(pill).toHaveAttribute('title', 'on the printer')
  })
})
