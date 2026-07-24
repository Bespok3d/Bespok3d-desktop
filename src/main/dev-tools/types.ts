export interface HunkLine {
  tag: ' ' | '+' | '-'
  text: string
}

export interface Hunk {
  id: string
  title: string
  lines: HunkLine[]
  suggestedOffset: number
}

export interface ConfidencePoint {
  offset: number
  confidence: number
}

export interface HunkCandidate {
  offset: number
  confidence: number
}

export interface HunkAnalysis {
  hunkId: string
  state: 'snapped' | 'ambiguous' | 'no_match'
  confidenceProfile: ConfidencePoint[]
  candidates: HunkCandidate[]
}

export interface PatchTarget {
  id: string
  name: string
  content: string
}

export interface PatchSession {
  patchId: string
  target: PatchTarget
  hunks: Hunk[]
  analyses: HunkAnalysis[]
}

export interface Resolution {
  hunkId: string
  method: 'auto_snapped' | 'nudged' | 'manual_edit'
  finalOffset: number | null
  manualText?: string
  replaceRange?: { start: number; end: number }
}

export interface ApplyRequest {
  patchId: string
  resolutions: Resolution[]
}
