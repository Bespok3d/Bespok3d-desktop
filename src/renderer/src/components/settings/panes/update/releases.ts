// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAsyncResource } from '../../../common/hooks/useAsyncResource'

export interface ReleasesRead {
  releases: AppReleaseRow[] | null
  // Null while the list is loading and once it has been read. Set when the list could not be read, so
  // the pane can say which of the three things went wrong and offer another try.
  problem: UpdateProblem | null
  reload: () => void
}

// The published app releases (for the rollback/version list and the "what's new" notes). Main answers
// with a problem rather than a rejection, so the only way this hook's own `error` fires is the IPC
// call itself failing, which is the same "cannot be read right now" the user is told about.
export function useReleases(): ReleasesRead {
  const { value, error, reload } = useAsyncResource(() => window.b3d.appUpdate.listReleases(), [])
  // A rejection is always the latest word: it outranks the problem carried by whatever was read before
  // it, which by then describes a read that is no longer the current one.
  const problem = error ? 'unavailable' : (value?.problem ?? null)

  return { releases: value?.releases ?? null, problem, reload }
}

// A version above the running build is offered as an "update"; one below it as an "install" (a
// rollback). "Reinstall" was wrong: you may never have run the version you are picking.
export function releaseVerb(release: AppReleaseRow): 'update' | 'install' {
  return release.isNewer ? 'update' : 'install'
}
