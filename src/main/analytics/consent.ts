// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The one question the window asks about consent, answered in one read. Two facts come back because
// two surfaces need them and they must never disagree: the Settings switch needs the answer already
// stored, and the first-launch request needs to know whether to appear at all.
//
// An absent answer is not a refusal. It is the state of an install that has never been asked, which
// is what makes an app that updates into this version get asked exactly as a fresh install does.
import { loadSettings, saveSettings } from '../settings'
import { usageReportingIsLive } from './index'

export interface UsageReportingConsent {
  answer: 'granted' | 'refused' | null
  // True only for an install that has never answered, on a run where an answer would mean something.
  // An unattended run is never asked, which is what lets it finish with nobody there to answer.
  ask: boolean
}

export function usageReportingConsent(): UsageReportingConsent {
  const answer = loadSettings().analyticsConsent ?? null

  return { answer, ask: answer === null && usageReportingIsLive() }
}

// The answer is the only thing stored. There is nothing else to create when it turns to yes and
// nothing else to destroy when it turns to no, because no value that could tell this install from
// another one is ever made.
export function setAnalyticsConsent(granted: boolean): void {
  saveSettings({ analyticsConsent: granted ? 'granted' : 'refused' })
}
