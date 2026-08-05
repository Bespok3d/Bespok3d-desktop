// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom
// The Licence tab exists so a user can see what a plugin is licensed under and whose code it carries
// WITHOUT the store downloading or opening the package: both facts ride the list entry.
import { describe, it, expect } from 'vitest'
import { setup } from '../../../../test/harness'
import { makePlugin } from '../../../../test/fixtures'
import { detailTabs } from '.'
import { PanelLicence } from './licence'

const LICENCE_LINK = 'https://github.com/Bespok3d/u1-hw-camera/blob/main/plugin/doc/LICENSE'
const ATTRIBUTIONS = '# Attributions\n\nUpstream: the Fluidd project, GPL-3.0.\n'

function tabsFor(plugin = makePlugin()) {
  return detailTabs(plugin, false, false, false)
}

describe('the Licence tab appears only when the list entry carries the facts', () => {
  it('stays hidden for a plugin whose entry states neither a licence link nor attributions', () => {
    expect(tabsFor()).not.toContain('license')
  })

  it('appears for a plugin whose entry states only a licence link', () => {
    expect(tabsFor(makePlugin({ licenseUrl: LICENCE_LINK }))).toContain('license')
  })

  it('appears for a plugin whose entry states only attributions', () => {
    expect(tabsFor(makePlugin({ attributions: ATTRIBUTIONS }))).toContain('license')
  })
})

describe('what the Licence tab shows', () => {
  it('links out to the licence instead of printing the whole licence text', () => {
    setup(<PanelLicence plugin={makePlugin({ licenseUrl: LICENCE_LINK, attributions: ATTRIBUTIONS })} />)
    const link = document.querySelector<HTMLAnchorElement>('.panel-doc a.doc-homepage-link')
    expect(link?.href).toBe(LICENCE_LINK)
    expect(document.body.textContent).toContain('Upstream: the Fluidd project, GPL-3.0.')
    expect(document.body.textContent).not.toContain('GNU GENERAL PUBLIC LICENSE')
  })

  it('says so plainly when the entry carries a licence but nobody to credit', () => {
    setup(<PanelLicence plugin={makePlugin({ licenseUrl: LICENCE_LINK })} />)
    expect(document.querySelector('.panel-doc-empty')).toBeTruthy()
  })
})
