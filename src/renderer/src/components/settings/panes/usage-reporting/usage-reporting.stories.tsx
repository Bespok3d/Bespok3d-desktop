// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { UsageReportingGroup } from './index'
import { UsageReportingRequest } from './UsageReportingRequest'
import { WhatIsSent } from './what-is-sent'
import '../../settings.css'

export default { title: 'Settings / Usage reporting' }

// The catalog stub starts unanswered, so the switch reads off and the request appears. Both stories
// share that one stored answer: say yes in the request and the settings group agrees, which is the
// whole point of the group reading the answer instead of being handed it.
export function SettingsGroup() {
  return (
    <div className="settings-body">
      <UsageReportingGroup />
    </div>
  )
}

export function TheOneTimeRequest() {
  return <UsageReportingRequest />
}

// The same list in both places, on its own, because a reader checking the wording only wants the words.
export function WhatIsAndIsNotSent() {
  return (
    <div className="settings-body">
      <WhatIsSent />
    </div>
  )
}
