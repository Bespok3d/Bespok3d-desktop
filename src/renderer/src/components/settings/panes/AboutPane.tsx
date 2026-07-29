// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MouseEvent } from 'react'
import { Group } from '../../common/Group'
import { useI18n } from '../../../i18n/context'
import { BrandMark } from '../../../design-system/BrandMark'
import { ABOUT_LINK_URLS, ABOUT_LINK_ROW_ORDER, type AboutLinkName } from './about-links'

const PLATFORM_LABEL: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

function openAboutLink(linkName: AboutLinkName) {
  return function openInTheSystemBrowser(event: MouseEvent<HTMLElement>) {
    event.preventDefault()
    window.b3d.openUrl(ABOUT_LINK_URLS[linkName])
  }
}

export function AboutPane() {
  const { t } = useI18n()
  const platformLabel = PLATFORM_LABEL[window.b3d.platform] ?? window.b3d.platform
  const archLabel = window.b3d.arch

  return (
    <Group>
      <div className="about-block">
        <div className="about-title-row">
          <BrandMark tile={80} />
          <h1>Bespok3d</h1>
        </div>
        <div className="about-version mono">
          {__APP_VERSION__} · {platformLabel} {archLabel}
        </div>
        <h2>{t('about.tagline')}</h2>
        <p>{t('about.copyright')}</p>
        <p>{t('about.license')}</p>
        <p>{t('about.warranty')}</p>
        <p>{t('about.source')}</p>
        <p>{t('about.made_with')}</p>
        <div className="about-links">
          {ABOUT_LINK_ROW_ORDER.map((linkName) => (
            <a key={linkName} href={ABOUT_LINK_URLS[linkName]} onClick={openAboutLink(linkName)}>
              {t(`about.${linkName}`)}
            </a>
          ))}
        </div>
        <button className="about-coffee" onClick={openAboutLink('buy_coffee')}>
          {t('about.buy_coffee')}
        </button>
      </div>
    </Group>
  )
}
