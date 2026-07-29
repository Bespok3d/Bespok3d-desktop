// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ApplyRequest, Hunk, Resolution } from './types'

function preImageLength(hunk: Hunk): number {
  return hunk.lines.filter((line) => line.tag === ' ' || line.tag === '-').length
}

function postImageLines(hunk: Hunk): string[] {
  return hunk.lines.filter((line) => line.tag === ' ' || line.tag === '+').map((line) => line.text)
}

function applyResolution(lines: string[], resolution: Resolution, hunk: Hunk): void {
  if (resolution.method === 'manual_edit') {
    const { start, end } = resolution.replaceRange!
    const replacement = (resolution.manualText ?? '').split('\n')
    lines.splice(start - 1, end - start + 1, ...replacement)

    return
  }
  const offset = resolution.finalOffset!
  lines.splice(offset - 1, preImageLength(hunk), ...postImageLines(hunk))
}

function offsetOf(resolution: Resolution): number {
  return resolution.method === 'manual_edit'
    ? (resolution.replaceRange?.start ?? 0)
    : (resolution.finalOffset ?? 0)
}

export function applyPatch(targetContent: string, req: ApplyRequest, hunks: Hunk[]): string {
  const lines = targetContent.split('\n')
  const sorted = [...req.resolutions].sort((earlier, later) => offsetOf(later) - offsetOf(earlier))
  sorted.forEach((resolution) => {
    const hunk = hunks.find((candidate) => candidate.id === resolution.hunkId)
    if (hunk) applyResolution(lines, resolution, hunk)
  })

  return lines.join('\n')
}
