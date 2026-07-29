// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MouseEvent } from 'react'
import { Group } from '../../common/Group'
import { useI18n } from '../../../i18n/context'
import { BrandMark } from '../../../design-system/BrandMark'

const PLATFORM_LABEL: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }

const SOURCE_REPOSITORY_URL = 'https://github.com/Bespok3d/Bespok3d-desktop'

function openSourceRepository(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  window.b3d.openUrl(SOURCE_REPOSITORY_URL)
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
          <a href="#" onClick={(event) => event.preventDefault()}>{t('about.release_notes')}</a>
          <a href="#" onClick={(event) => event.preventDefault()}>{t('about.docs')}</a>
          <a href={SOURCE_REPOSITORY_URL} onClick={openSourceRepository}>{t('about.github')}</a>
          <a href="#" onClick={(event) => event.preventDefault()}>{t('about.report_issue')}</a>
        </div>
        <button className="about-coffee" onClick={() => window.b3d.openUrl('https://buymeacoffee.com/unlucio')}>
          {t('about.buy_coffee')}
        </button>
      </div>
    </Group>
  )
}
