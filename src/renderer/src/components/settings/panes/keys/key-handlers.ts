import type { KeyRecord, KeyAssignment } from '../../../../data/keyTypes'
import type { Printer } from '../../../../data/types'

// The per-key data + mutation callbacks the keys pane threads straight down to each key row, so both
// the pane props and the row props share this one shape instead of mirroring the eight members.
export interface KeyHandlers {
  printers: Printer[]
  gitHostSettings: GitHostSettings | null
  allUserRepos: { owner: string; repo: string }[]
  onRemove: (key: KeyRecord) => void
  onSetDefault: (key: KeyRecord) => Promise<void>
  onSetAssignments: (key: KeyRecord, assignments: KeyAssignment[]) => Promise<void>
  onSetIcon: (key: KeyRecord, color?: string, image?: string, size?: number) => Promise<void>
  onSetPublishedAt: (key: KeyRecord, date: string | null) => void
}
