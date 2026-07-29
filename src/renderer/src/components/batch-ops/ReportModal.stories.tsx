// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { BatchReportModal } from './ReportModal'

export default { title: 'Batch ops / BatchReportModal' }

// The shell both endings of a batch op are read in. Here on its own: the verdict line in green when
// the printer did the work, in red when it did not.
export function WentWell() {
  return (
    <BatchReportModal title="Update finished" summary="Every plugin updated." summaryTone="ok" size="size-md" onClose={() => {}}>
      <div className="recovery-list">
        <div className="recovery-row"><span className="u-flex-1">camera</span></div>
        <div className="recovery-row"><span className="u-flex-1">spoolman</span></div>
      </div>
    </BatchReportModal>
  )
}

// Nothing to list under the verdict: the printer would not take the call, so the reason is the whole
// report.
export function DidNotRun() {
  return (
    <BatchReportModal
      title="Update was interrupted"
      summary="The printer is busy: this would restart Klipper, Moonraker, interrupting the print. Try again when it is idle."
      summaryTone="bad"
      size="size-sm"
      onClose={() => {}}
    />
  )
}
