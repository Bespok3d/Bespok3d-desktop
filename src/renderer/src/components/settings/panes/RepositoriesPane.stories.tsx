// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RepositorySourceRow } from './source-row'
import { makeT } from '../../../i18n'
import type { SourceRow } from '../../../data/types'
import '../settings.css'

export default { title: 'Settings / Repositories / Source status' }

const t = makeT('en')
function noop(): void {}

const MISSING_PRERELEASE: SourceRow = {
  url: 'github:Bespok3d/main-index/index.json?ref=dev',
  label: 'github:Bespok3d/main-index/index.json?ref=dev',
  name: 'Bespok3d Official prerelease', trust: 'project', locked: true,
  enabled: true, status: 'failed', pluginCount: 0,
  error: 'HTTP 404: dev index not found', reason: 'notfound',
}

export function MissingPrereleaseIndex() {
  return <div className="settings-body"><RepositorySourceRow source={MISSING_PRERELEASE} gitHubConnected t={t} onToggle={noop} onConnectGitHub={noop} /></div>
}
