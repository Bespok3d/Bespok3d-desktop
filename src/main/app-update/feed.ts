// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export interface AppUpdateFeed {
  provider: 'github'
  owner: string
  repo: string
}

// Where the app looks for its own updates: the PUBLIC release stream, which the updater reads over
// the CDN with no credentials at all. Getting the app updated is nobody's account business - a GitHub
// account is asked for to publish a plugin and for nothing else - so no token is named here and the
// feed is never declared private. An unset app repo is the one thing that leaves auto-update off, and
// it is unset only in a build with no release home.
export function autoUpdateFeed(appUpdateRepo: { owner: string; repo: string } | undefined): AppUpdateFeed | null {
  if (!appUpdateRepo) return null

  return { provider: 'github', owner: appUpdateRepo.owner, repo: appUpdateRepo.repo }
}
