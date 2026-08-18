// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export const SOURCE_REPOSITORY_URL = 'https://github.com/Bespok3d/Bespok3d-desktop'

// GitHub drops a request whose URL is too long, so a report that would exceed this is cut rather
// than opening an empty issue form.
const ISSUE_BODY_MAX_CHARS = 6000

// A prefilled "New issue" URL on a GitHub repo: the report travels in the link, so the reporter only
// has to press Submit.
export function githubIssueUrl(repositoryUrl: string, title: string, body: string): string {
  const query = `title=${encodeURIComponent(title)}&body=${encodeURIComponent(body.slice(0, ISSUE_BODY_MAX_CHARS))}`

  return `${repositoryUrl}/issues/new?${query}`
}
