// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PUBLISHER_REPO, keyFilePath } from '../../../main/publisher/repo'

export { PUBLISHER_REPO, keyFilePath }

export function publisherRepoUrl(settings: GitHostSettings, owner: string): string | null {
  if (settings.type === 'github') return `https://github.com/${owner}/${PUBLISHER_REPO}`

  return settings.giteaUrl ? `${settings.giteaUrl}/${owner}/${PUBLISHER_REPO}` : null
}

export function buildReadme(
  entries: { label: string; fingerprint: string; date: string }[]
): string {
  const rows = entries.map(
    (entry) => `| ${entry.label} | ${entry.date} | [${entry.fingerprint}](${keyFilePath(entry.fingerprint)}) |`
  )

  return ['# Publisher keys', '', '| Name | Published | Public key |', '|---|---|---|', ...rows, ''].join('\n')
}
