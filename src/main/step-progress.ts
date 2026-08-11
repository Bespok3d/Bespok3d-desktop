// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// How far into itself a running step has got, as the step reports it.

// A step hints as it works, and only some of those hints carry a number: a phase that knows its own
// size (a file upload knows its file count) reports one, a phase that cannot measure itself (one pip
// run) does not. The last number carries forward to the hints that follow it, so the bar holds where
// the measured phase left it instead of dropping back to the step's halfway default.
export function stepFractionCarry(): (stepFraction?: number) => number | undefined {
  var carried: number | undefined

  return function carry(stepFraction?: number): number | undefined {
    carried = stepFraction ?? carried

    return carried
  }
}
