// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ReleaseChannel } from '../settings'
import type { MergedEntry } from '../registry/model'

// Where the copy of a plugin the app is about to send comes from: the source the copy on the printer
// was installed from, and the channel it was offered on. Absent for a plugin whose source was never
// recorded, and for a dependency the app adds on its own, and those fall back to the catalog winner.
export interface PackageOrigin {
  sourceUrl?: string
  channel?: ReleaseChannel
}

// The catalog entry for a plugin as it stands at one source and channel: the variant that matches,
// the winner when neither is named or none matches, and nothing at all when no source lists the
// plugin. A variant's identity is registry_url x channel, so both narrow the pick.
//
// Everything the app decides about a package has to be decided on the entry whose bytes it will
// actually send: the winner of a plugin name can be a different build from a different source, with
// different requirements. Answering "what does this need?" from the winner while sending the
// variant's bytes is how a printer is handed a package it then refuses.
export function catalogVariantOrNone(
  plugins: readonly MergedEntry[],
  pluginId: string,
  origin: PackageOrigin = {},
): MergedEntry | undefined {
  const winner = plugins.find((candidate) => candidate.name === pluginId)
  if (!winner) return undefined
  if (!origin.sourceUrl && !origin.channel) return winner
  const match = (winner.variants ?? []).find(
    (variant) => (!origin.sourceUrl || variant.registry_url === origin.sourceUrl) && (!origin.channel || variant.channel === origin.channel),
  )

  return match ?? winner
}
