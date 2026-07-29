// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'

// The published app releases (for the rollback/version list and the "what's new" notes). A failed fetch
// surfaces as `error` rather than silently reading as an empty list.
export function useReleases(): { releases: AppReleaseRow[] | null; error: string | null } {
  const { value, error } = useAsyncResource(() => window.b3d.appUpdate.listReleases(), [])

  return { releases: value, error }
}

// A version above the running build is offered as an "update"; one below it as an "install" (a
// rollback). "Reinstall" was wrong: you may never have run the version you are picking.
export function releaseVerb(release: AppReleaseRow): 'update' | 'install' {
  return release.isNewer ? 'update' : 'install'
}
