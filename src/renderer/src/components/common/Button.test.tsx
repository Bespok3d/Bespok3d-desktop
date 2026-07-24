// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../test/harness'
import { Button } from './Button'

describe('Button', () => {
  it('renders an accessible button with the base class', () => {
    setup(<Button>Install</Button>)
    const button = screen.getByRole('button', { name: 'Install' })
    expect(button).toHaveClass('btn')
  })

  it('maps variant and size to the existing css contract', () => {
    setup(
      <Button variant="danger-outline" size="sm">
        Remove
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Remove' })
    expect(button).toHaveClass('btn', 'danger-outline', 'sm')
  })

  it('renders an icon-only button', () => {
    setup(
      <Button icon aria-label="Refresh">
        x
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Refresh' })).toHaveClass('btn', 'icon')
  })

  it('busy adds the refreshing class, disables the button, and sets aria-busy', () => {
    setup(<Button busy>Working</Button>)
    const button = screen.getByRole('button', { name: 'Working' })
    expect(button).toHaveClass('btn', 'refreshing')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('does not fire onClick while disabled', async () => {
    const onClick = vi.fn()
    const harness = setup(
      <Button disabled onClick={onClick}>
        Apply
      </Button>
    )
    await harness.user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires onClick and forwards native attributes', async () => {
    const onClick = vi.fn()
    const harness = setup(
      <Button onClick={onClick} title="hint" type="submit" className="extra">
        Go
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Go' })
    expect(button).toHaveAttribute('title', 'hint')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveClass('btn', 'extra')
    await harness.user.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
