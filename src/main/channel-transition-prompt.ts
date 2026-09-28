// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { execFileSync } from 'child_process'
import { app, dialog, safeStorage } from 'electron'
import { join } from 'path'
import { channelTransitionText } from './channel-transition-copy'
import {
  betaTransitionState,
  migrateBetaProfile,
  processListHasBetaClient,
  recoverInterruptedBetaTransition,
} from './channel-transition'
import type { BetaTransitionResult, SafeStorageReader } from './channel-transition'

interface ProfileTransitionPaths {
  betaProfile: string
  stagingProfile: string
}

function betaClientIsRunning(): boolean {
  const processList = process.platform === 'win32'
    ? execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' })
    : execFileSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8' })

  return processListHasBetaClient(processList)
}

function transitionFailureMessage(result: BetaTransitionResult, betaProfile: string): string {
  if (result === 'beta-running') return channelTransitionText('closeBeta', betaProfile, app.getLocale())
  if (result === 'unreadable-encrypted-state') return channelTransitionText('unreadable', betaProfile, app.getLocale())
  if (result === 'unsafe-link') return channelTransitionText('unsafe', betaProfile, app.getLocale())
  if (result === 'interrupted') return channelTransitionText('interrupted', betaProfile, app.getLocale())

  return channelTransitionText('copyFailed', betaProfile, app.getLocale())
}

function transitionTitle(betaProfile: string): string {
  return channelTransitionText('title', betaProfile, app.getLocale())
}

async function attemptBetaTransition(
  paths: ProfileTransitionPaths,
  storage: SafeStorageReader,
): Promise<boolean> {
  var isRunning: boolean
  try {
    isRunning = betaClientIsRunning()
  } catch {
    await dialog.showMessageBox({
      type: 'warning',
      title: transitionTitle(paths.betaProfile),
      message: channelTransitionText('cannotCheck', paths.betaProfile, app.getLocale()),
      buttons: [channelTransitionText('quitLater', paths.betaProfile, app.getLocale())],
    })

    return false
  }

  const result = migrateBetaProfile(paths.betaProfile, paths.stagingProfile, storage, isRunning)
  if (result === 'copied' || result === 'complete') return true
  if (result === 'beta-running' || result === 'interrupted') {
    await dialog.showMessageBox({
      type: 'warning',
      title: transitionTitle(paths.betaProfile),
      message: transitionFailureMessage(result, paths.betaProfile),
      buttons: [channelTransitionText('quitLater', paths.betaProfile, app.getLocale())],
    })

    return false
  }

  const answer = await dialog.showMessageBox({
    type: 'warning',
    title: transitionTitle(paths.betaProfile),
    message: transitionFailureMessage(result, paths.betaProfile),
    buttons: [channelTransitionText('fresh', paths.betaProfile, app.getLocale()), channelTransitionText('retryLater', paths.betaProfile, app.getLocale())],
    defaultId: 1,
    cancelId: 1,
  })

  return answer.response === 0
}

async function chooseBetaProfileTransition(
  paths: ProfileTransitionPaths,
  storage: SafeStorageReader,
): Promise<boolean> {
  const answer = await dialog.showMessageBox({
    type: 'question',
    title: transitionTitle(paths.betaProfile),
    message: channelTransitionText('found', paths.betaProfile, app.getLocale()),
    buttons: [channelTransitionText('copy', paths.betaProfile, app.getLocale()), channelTransitionText('fresh', paths.betaProfile, app.getLocale()), channelTransitionText('quitLater', paths.betaProfile, app.getLocale())],
    defaultId: 0,
    cancelId: 2,
  })
  if (answer.response === 0) return attemptBetaTransition(paths, storage)

  return answer.response === 1
}

async function recoverBetaProfileTransition(
  paths: ProfileTransitionPaths,
  storage: SafeStorageReader,
): Promise<boolean> {
  const answer = await dialog.showMessageBox({
    type: 'warning',
    title: transitionTitle(paths.betaProfile),
    message: channelTransitionText('partial', paths.betaProfile, app.getLocale()),
    buttons: [channelTransitionText('retry', paths.betaProfile, app.getLocale()), channelTransitionText('discardFresh', paths.betaProfile, app.getLocale()), channelTransitionText('quitLater', paths.betaProfile, app.getLocale())],
    defaultId: 0,
    cancelId: 2,
  })
  if (answer.response === 2) return false

  recoverInterruptedBetaTransition(paths.stagingProfile)
  if (answer.response === 1) return true

  return attemptBetaTransition(paths, storage)
}

async function openExistingStagingProfile(paths: ProfileTransitionPaths): Promise<boolean> {
  const answer = await dialog.showMessageBox({
    type: 'warning',
    title: transitionTitle(paths.betaProfile),
    message: channelTransitionText('conflict', paths.betaProfile, app.getLocale()),
    buttons: [channelTransitionText('openStaging', paths.betaProfile, app.getLocale()), channelTransitionText('quitLater', paths.betaProfile, app.getLocale())],
    defaultId: 1,
    cancelId: 1,
  })

  return answer.response === 0
}

export async function prepareBetaProfileTransition(
  betaProfileName: string | null,
  stagingProfile: string,
): Promise<boolean> {
  if (!betaProfileName) return true

  const paths = {
    betaProfile: join(app.getPath('appData'), betaProfileName),
    stagingProfile,
  }
  const state = betaTransitionState(paths.betaProfile, stagingProfile)
  if (state === 'absent' || state === 'complete') return true
  if (state === 'staging-conflict') return openExistingStagingProfile(paths)
  if (state === 'interrupted') return recoverBetaProfileTransition(paths, safeStorage as SafeStorageReader)

  return chooseBetaProfileTransition(paths, safeStorage as SafeStorageReader)
}
