// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export interface AppUpdateFeed {
  provider: 'github'
  owner: string
  repo: string
  private: true
  token: string
}

// In-app auto-update is config-gated: it runs only when an app repo is configured AND a GitHub
// token is present (electron-updater's private github provider needs the token). An unset repo or
// an absent token yields null, so auto-update stays disabled (the default until the app repo exists).
export function autoUpdateFeed(
  appUpdateRepo: { owner: string; repo: string } | undefined,
  token: string | null,
): AppUpdateFeed | null {
  if (!appUpdateRepo || !token) return null

  return { provider: 'github', owner: appUpdateRepo.owner, repo: appUpdateRepo.repo, private: true, token }
}
