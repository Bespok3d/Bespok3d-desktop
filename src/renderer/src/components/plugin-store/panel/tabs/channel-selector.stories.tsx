// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { ChannelSelector } from './channel-selector'
import { makePlugin, makeSource } from '../../../../test/fixtures'
import { makeT } from '../../../../i18n'
import type { ReleaseChannel } from '../../../../data/types'
import '../../plugin-store.css'

export default { title: 'Store / Config / ChannelSelector' }

const t = makeT('en')

const MULTI_CHANNEL_PLUGIN = makePlugin({
  id: 'wled', name: 'wled', title: 'WLED',
  sources: [
    makeSource({ channel: 'lts', version: '0.9.0' }),
    makeSource({ channel: 'stable', version: '1.0.0' }),
    makeSource({ channel: 'rc', version: '1.1.0-rc.1' }),
    makeSource({ channel: 'testing', version: '1.2.0-beta.1' }),
    makeSource({ channel: 'experiment', version: '2.0.0-exp.1' }),
  ],
})

function Selector({ ceiling }: { ceiling: ReleaseChannel }) {
  const [channelFilter, setChannelFilter] = useState<ReleaseChannel | 'all'>('all')

  return <ChannelSelector plugin={MULTI_CHANNEL_PLUGIN} ceiling={ceiling} channelFilter={channelFilter} onPick={setChannelFilter} t={t} />
}

// The user's ceiling is stable: rc/testing/experiment chips are marked "above ceiling" but still pickable.
export function CeilingStable() {
  return <Selector ceiling="stable" />
}

// A user who opted into the riskiest ceiling sees every channel as reachable, none marked.
export function CeilingExperiment() {
  return <Selector ceiling="experiment" />
}

// A plugin publishing a single channel shows no selector at all (nothing to choose between).
export function SingleChannelHidden() {
  return <ChannelSelector plugin={makePlugin({ sources: [makeSource({ channel: 'stable' })] })} ceiling="stable" channelFilter="all" onPick={() => {}} t={t} />
}
