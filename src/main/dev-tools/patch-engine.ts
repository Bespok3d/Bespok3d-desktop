import type { Hunk, HunkLine, HunkAnalysis, ConfidencePoint, HunkCandidate, PatchSession, PatchTarget } from './types'

const SNAP_THRESHOLD = 80
const AMBIGUOUS_MIN = 50

function preImageLines(hunk: Hunk): string[] {
  return hunk.lines.filter((line) => line.tag === ' ' || line.tag === '-').map((line) => line.text)
}

function lineSimilarity(patchLine: string, sourceLine: string): number {
  if (patchLine === sourceLine) return 1.0
  const trimmedPatch = patchLine.trim()
  const trimmedSource = sourceLine.trim()
  if (trimmedPatch === trimmedSource) return 0.85
  if (!trimmedPatch || !trimmedSource) return 0.0
  if (trimmedPatch.length > 4 && sourceLine.includes(trimmedPatch)) return 0.5

  return 0.0
}

function scoreAtOffset(preImage: string[], sourceLines: string[], offset: number): number {
  if (preImage.length === 0) return 100
  const startIdx = offset - 1
  const { total, weightSum } = preImage.reduce(
    (acc, patchLine, lineIdx) => {
      const sourceLine = sourceLines[startIdx + lineIdx] ?? ''
      const weight = patchLine.trim().length > 0 ? 1.0 : 0.3

      return { total: acc.total + lineSimilarity(patchLine, sourceLine) * weight, weightSum: acc.weightSum + weight }
    },
    { total: 0, weightSum: 0 },
  )

  return Math.round((total / weightSum) * 100)
}

function buildProfile(preImage: string[], sourceLines: string[]): ConfidencePoint[] {
  const maxOffset = Math.max(1, sourceLines.length - preImage.length + 1)

  return Array.from({ length: maxOffset }, (_, offsetIdx) => ({
    offset: offsetIdx + 1,
    confidence: scoreAtOffset(preImage, sourceLines, offsetIdx + 1),
  }))
}

function pickCandidates(
  profile: ConfidencePoint[],
  suggestedOffset: number,
): { candidates: HunkCandidate[]; state: HunkAnalysis['state'] } {
  const strong = profile.filter((point) => point.confidence >= SNAP_THRESHOLD)
  if (strong.length === 1) {
    return { state: 'snapped', candidates: [{ offset: strong[0].offset, confidence: strong[0].confidence }] }
  }
  if (strong.length >= 2) {
    const sorted = [...strong].sort((left, right) => right.confidence - left.confidence)

    return { state: 'ambiguous', candidates: sorted.slice(0, 3).map((point) => ({ offset: point.offset, confidence: point.confidence })) }
  }
  const partial = profile
    .filter((point) => point.confidence >= AMBIGUOUS_MIN)
    .sort((left, right) => {
      if (right.confidence !== left.confidence) return right.confidence - left.confidence

      return Math.abs(left.offset - suggestedOffset) - Math.abs(right.offset - suggestedOffset)
    })
    .slice(0, 3)
    .map((point) => ({ offset: point.offset, confidence: point.confidence }))

  return { state: 'no_match', candidates: partial }
}

function hunkTitle(lines: HunkLine[], idx: number): string {
  const firstAdd = lines.find((line) => line.tag === '+')
  if (firstAdd?.text.trim()) {
    const snippet = firstAdd.text.trim().slice(0, 60)

    return snippet.length < firstAdd.text.trim().length ? `${snippet}…` : snippet
  }

  return `Hunk ${idx + 1}`
}

export function parseUnifiedDiff(patchContent: string): Hunk[] {
  const rawLines = patchContent.split('\n')
  const hunkStarts = rawLines
    .map((raw, idx) => ({ raw, idx }))
    .filter(({ raw }) => raw.startsWith('@@'))

  return hunkStarts
    .map(({ raw, idx }, hunkIdx) => {
      const matched = raw.match(/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/)
      const suggestedOffset = matched ? parseInt(matched[1], 10) : 1
      const endIdx = hunkStarts[hunkIdx + 1]?.idx ?? rawLines.length
      const lines: HunkLine[] = rawLines.slice(idx + 1, endIdx).flatMap((diffLine): HunkLine[] => {
        if (diffLine.startsWith('+') && !diffLine.startsWith('+++')) return [{ tag: '+' as const, text: diffLine.slice(1) }]
        if (diffLine.startsWith('-') && !diffLine.startsWith('---')) return [{ tag: '-' as const, text: diffLine.slice(1) }]
        if (diffLine.startsWith(' ')) return [{ tag: ' ' as const, text: diffLine.slice(1) }]

        return []
      })

      return { id: `h${hunkIdx + 1}`, title: hunkTitle(lines, hunkIdx), lines, suggestedOffset }
    })
    .filter((hunk) => hunk.lines.length > 0)
}

function analyzeHunk(hunk: Hunk, sourceLines: string[]): HunkAnalysis {
  const preImage = preImageLines(hunk)
  const profile = buildProfile(preImage, sourceLines)
  const { state, candidates } = pickCandidates(profile, hunk.suggestedOffset)

  return { hunkId: hunk.id, state, confidenceProfile: profile, candidates }
}

export function buildSession(patchId: string, target: PatchTarget, patchContent: string): PatchSession {
  const hunks = parseUnifiedDiff(patchContent)
  const sourceLines = target.content.split('\n')
  const analyses = hunks.map((hunk) => analyzeHunk(hunk, sourceLines))

  return { patchId, target, hunks, analyses }
}
