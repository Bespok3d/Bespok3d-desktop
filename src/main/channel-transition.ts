// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { basename, join } from 'path'

const PROFILE_STATE = [
  'settings.json',
  'printers',
  'keys',
  'keychain',
  'git-host.json',
  'registry-cache.json',
  'local-plugins',
  'plugin-cache',
]
const COPY_SUFFIX = '.beta-profile-copy'
const INCOMPLETE_MARKER = '.bespok3d-beta-transition-incomplete'
const COMPLETE_MARKER = '.bespok3d-beta-transition.json'

export type BetaTransitionState = 'absent' | 'needs-choice' | 'staging-conflict' | 'interrupted' | 'complete'
export type BetaTransitionResult =
  | 'copied'
  | 'complete'
  | 'missing-beta'
  | 'staging-conflict'
  | 'beta-running'
  | 'interrupted'
  | 'unsafe-link'
  | 'unreadable-encrypted-state'
  | 'copy-failed'

export interface SafeStorageReader {
  isEncryptionAvailable(): boolean
  decryptString(encryptedValue: Buffer): string
}

function profileStatePaths(profileDirectory: string): string[] {
  return PROFILE_STATE.map((entryName) => join(profileDirectory, entryName))
}

function hasProfileState(profileDirectory: string): boolean {
  return profileStatePaths(profileDirectory).some(existsSync)
}

function transitionMarker(profileDirectory: string, markerName: string): string {
  return join(profileDirectory, markerName)
}

function temporaryProfilePath(stagingProfile: string): string {
  return `${stagingProfile}${COPY_SUFFIX}`
}

export function betaTransitionState(betaProfile: string, stagingProfile: string): BetaTransitionState {
  if (existsSync(transitionMarker(stagingProfile, COMPLETE_MARKER))) return 'complete'
  if (existsSync(transitionMarker(stagingProfile, INCOMPLETE_MARKER))) return 'interrupted'
  if (hasProfileState(stagingProfile)) return 'staging-conflict'
  if (existsSync(temporaryProfilePath(stagingProfile))) return 'interrupted'
  if (!hasProfileState(betaProfile)) return 'absent'

  return 'needs-choice'
}

function containsSymbolicLink(path: string): boolean {
  const fileState = lstatSync(path)
  if (fileState.isSymbolicLink()) return true
  if (!fileState.isDirectory()) return false

  return readdirSync(path).some((entryName) => containsSymbolicLink(join(path, entryName)))
}

function selectedStateHasSymbolicLink(betaProfile: string): boolean {
  return profileStatePaths(betaProfile)
    .filter(existsSync)
    .some(containsSymbolicLink)
}

function copyBetaState(betaProfile: string, temporaryProfile: string): void {
  mkdirSync(temporaryProfile)
  profileStatePaths(betaProfile).filter(existsSync).forEach((sourcePath) => {
    cpSync(sourcePath, join(temporaryProfile, basename(sourcePath)), {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
    })
  })
}

function filesWithin(path: string): string[] {
  if (!lstatSync(path).isDirectory()) return [path]

  return readdirSync(path).flatMap((entryName) => filesWithin(join(path, entryName)))
}

function encryptedFiles(temporaryProfile: string): string[] {
  const keychainDirectory = join(temporaryProfile, 'keychain')
  if (!existsSync(keychainDirectory)) return []

  return filesWithin(keychainDirectory).filter((path) => path.endsWith('.enc'))
}

function encryptedStateCanBeRead(temporaryProfile: string, safeStorage: SafeStorageReader): boolean {
  const encryptedPaths = encryptedFiles(temporaryProfile)
  if (encryptedPaths.length === 0) return true
  if (!safeStorage.isEncryptionAvailable()) return false

  try {
    encryptedPaths.forEach((encryptedPath) => safeStorage.decryptString(readFileSync(encryptedPath)))

    return true
  } catch {
    return false
  }
}

function removeTemporaryProfile(stagingProfile: string): void {
  rmSync(temporaryProfilePath(stagingProfile), { recursive: true, force: true })
}

function cleanIncompleteCopy(stagingProfile: string): void {
  const incompleteMarker = transitionMarker(stagingProfile, INCOMPLETE_MARKER)
  if (existsSync(incompleteMarker)) {
    profileStatePaths(stagingProfile).forEach((statePath) => {
      rmSync(statePath, { recursive: true, force: true })
    })
    rmSync(incompleteMarker, { force: true })
  }

  removeTemporaryProfile(stagingProfile)
}

export function recoverInterruptedBetaTransition(stagingProfile: string): boolean {
  const interruptedMarker = transitionMarker(stagingProfile, INCOMPLETE_MARKER)
  if (!existsSync(interruptedMarker) && !existsSync(temporaryProfilePath(stagingProfile))) return false

  cleanIncompleteCopy(stagingProfile)

  return true
}

export function migrateBetaProfile(
  betaProfile: string,
  stagingProfile: string,
  safeStorage: SafeStorageReader,
  betaClientRunning: boolean,
): BetaTransitionResult {
  const currentState = betaTransitionState(betaProfile, stagingProfile)
  if (currentState === 'complete') return 'complete'
  if (currentState === 'absent') return 'missing-beta'
  if (currentState === 'staging-conflict') return 'staging-conflict'
  if (currentState === 'interrupted') return 'interrupted'
  if (betaClientRunning) return 'beta-running'
  if (selectedStateHasSymbolicLink(betaProfile)) return 'unsafe-link'

  const temporaryProfile = temporaryProfilePath(stagingProfile)

  return commitBetaProfileCopy(betaProfile, stagingProfile, temporaryProfile, safeStorage)
}

function commitBetaProfileCopy(
  betaProfile: string,
  stagingProfile: string,
  temporaryProfile: string,
  safeStorage: SafeStorageReader,
): BetaTransitionResult {
  try {
    copyBetaState(betaProfile, temporaryProfile)
    if (!encryptedStateCanBeRead(temporaryProfile, safeStorage)) {
      removeTemporaryProfile(stagingProfile)

      return 'unreadable-encrypted-state'
    }
    if (hasProfileState(stagingProfile)) {
      removeTemporaryProfile(stagingProfile)

      return 'staging-conflict'
    }

    mkdirSync(stagingProfile, { recursive: true })
    writeFileSync(transitionMarker(stagingProfile, INCOMPLETE_MARKER), 'Beta profile copy in progress\n', { flag: 'wx' })
    profileStatePaths(temporaryProfile).filter(existsSync).forEach((temporaryPath) => {
      renameSync(temporaryPath, join(stagingProfile, basename(temporaryPath)))
    })
    writeFileSync(transitionMarker(stagingProfile, COMPLETE_MARKER), '{"source":"Bespok3d Beta"}\n', { flag: 'wx' })
    rmSync(transitionMarker(stagingProfile, INCOMPLETE_MARKER), { force: true })
    removeTemporaryProfile(stagingProfile)

    return 'copied'
  } catch {
    if (!existsSync(transitionMarker(stagingProfile, INCOMPLETE_MARKER))) {
      removeTemporaryProfile(stagingProfile)

      return 'copy-failed'
    }

    return 'interrupted'
  }
}

export function processListHasBetaClient(processList: string): boolean {
  return processList.split(/\r?\n/).some((processName) => {
    const imageName = processName.trim().replace(/^"([^"]+)".*$/, '$1')
    const executableName = imageName.split(/[\\/]/).at(-1)?.toLowerCase() ?? ''

    return /^bespok3d beta(?:$| helper|\.exe$)/.test(executableName)
  })
}
