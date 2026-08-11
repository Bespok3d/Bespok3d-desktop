// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAsyncResource } from '../components/common/hooks/useAsyncResource'

// The three things a caller holding a printer's adapter id and nothing else needs from the adapter set
// this build ships: the avatar image, what the adapter calls the printer it drives ("Snapmaker U1"),
// and the device-side (jinni) version this build would install. Titles are what a printer card shows
// beside the nickname: the printer's own mDNS model is missing or generic on most networks, while the
// adapter is chosen at enrollment and is therefore always known.
export interface AdapterViews {
  icons: Record<string, string>
  titles: Record<string, string>
  jinniVersions: Record<string, string>
}

// An adapter that declares nothing for the field is left out, so a missing key reads as "not declared"
// rather than an empty string.
function declaredField(adapters: AdapterInfo[], field: 'icon' | 'title' | 'jinniVersion'): Record<string, string> {
  const declared = adapters.filter((adapter) => adapter[field])

  return Object.fromEntries(declared.map((adapter) => [adapter.id, adapter[field] as string]))
}

// The adapter set is static for a build, so this reads once and never refreshes.
export function useAdapterViews(): AdapterViews {
  const { value } = useAsyncResource(() => window.b3d.printers.adaptersList(), [])
  const adapters = value ?? []

  return {
    icons: declaredField(adapters, 'icon'),
    titles: declaredField(adapters, 'title'),
    jinniVersions: declaredField(adapters, 'jinniVersion'),
  }
}
