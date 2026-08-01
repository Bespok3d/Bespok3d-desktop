// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The registry each version in a batch comes from, one entry per version. The install gate reads it to
// tell a batch built entirely from versions held on this machine from one that touches a published
// list; a spec whose source the click did not know contributes an unknown, which keeps the offer.
export function batchSources(specs: PluginUpdateSpec[]): Array<string | undefined> {
  return specs.map((spec) => spec.sourceUrl)
}
