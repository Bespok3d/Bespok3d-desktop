// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Ask a plugin's own repo, while its page is open, what it last released. This is what lets a
// publisher's fix show up in the store without the org republishing a list.
//
// Undefined until the answer arrives, and undefined forever when the repo has nothing newer or cannot
// be asked, so the page renders the listed version immediately and never shows a spinner or an error
// for a refresh that is an improvement on the list rather than a requirement of it.
import { useAsyncResource } from '../../common/hooks/useAsyncResource'

export function useFreshestVersion(pluginId: string, sourceUrl?: string): string | undefined {
  function loadFreshestVersion() {
    return window.b3d.registry.freshestVersion(pluginId, sourceUrl)
  }

  return useAsyncResource(loadFreshestVersion, [pluginId, sourceUrl]).value ?? undefined
}
