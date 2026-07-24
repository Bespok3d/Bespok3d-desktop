// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { setup } from '../../../../test/harness'
import { makeT } from '../../../../i18n'
import { UpdatePane } from './index'

const en = makeT('en')

describe('UpdatePane', () => {
  it('surfaces a failed release fetch instead of silently showing no releases', async () => {
    var listReleases = vi.fn().mockRejectedValue(new Error('release feed offline'))
    setup(<UpdatePane />, { b3d: { appUpdate: { listReleases } } })
    expect(await screen.findByText('release feed offline')).toBeInTheDocument()
    expect(screen.queryByText(en('set.update.no_releases'))).not.toBeInTheDocument()
  })

  it('checks for updates on demand', async () => {
    var { user, b3d } = setup(<UpdatePane />)
    await user.click(screen.getByRole('button', { name: en('set.update.check') }))
    expect(b3d.appUpdate.checkNow).toHaveBeenCalled()
  })

  it('persists the check-frequency preference', async () => {
    var { user, b3d } = setup(<UpdatePane />)
    var combo = (await screen.findAllByRole('combobox'))[0]
    await user.selectOptions(combo, 'daily')
    expect(b3d.settings.set).toHaveBeenCalledWith({ appUpdateFrequency: 'daily' })
  })
})
