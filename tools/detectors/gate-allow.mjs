// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared annotation reader for the cleanup gate (no deps).
//
// A genuine smell that has a deliberate, reviewed reason to remain is EXEMPTED in place with
//   gate-allow <metric>: <reason>
// in a comment on the smell's own line OR the nearest preceding non-blank line. The detectors
// import this and count only UN-annotated smells, so the justification lives at the smell site,
// is reviewed in the diff, and survives the question "why is THIS one ok?".
//
// The reason is MANDATORY: a bare `gate-allow <metric>` does not exempt. This is the line that
// keeps the gate honest - an exception is per-instance + justified, never a blanket mute.
// (False-positives are a different thing: those are detector-correctness bugs, fixed in the
// detector, never annotated. See feedback_fix_or_mute_not_handwave.)

const matcher = (metric) => new RegExp(`gate-allow\\s+${metric}\\s*:\\s*\\S`)

export function isExempt(lines, lineNumber, metric) {
  const pattern = matcher(metric)
  if (pattern.test(lines[lineNumber - 1] || '')) return true
  let probe = lineNumber - 2
  while (probe >= 0 && lines[probe].trim() === '') probe--
  return probe >= 0 && pattern.test(lines[probe])
}

export function fileExempt(text, metric) {
  return matcher(metric).test(text)
}

export function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}
