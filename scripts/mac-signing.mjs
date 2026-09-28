// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function runSecurityCommand(argumentsList, executeSecurity = execFileSync) {
  try {
    return executeSecurity('/usr/bin/security', argumentsList, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    throw new Error('A macOS signing-keychain operation failed.')
  }
}

function existingKeychains(securityOutput) {
  return securityOutput.split(/\r?\n/)
    .map((keychainPath) => keychainPath.trim().replace(/^"(.*)"$/, '$1'))
    .filter(Boolean)
}

function signingIdentity(keychainPath, runSecurity) {
  const identities = runSecurity(['find-identity', '-v', '-p', 'codesigning', keychainPath])
  const fingerprint = identities.match(/^\s*\d+\)\s+([A-F0-9]{40})\s+"/m)?.[1]
  if (!fingerprint) throw new Error('The imported certificate contains no valid macOS code-signing identity.')

  return fingerprint
}

function restoreSigningKeychain(runSecurity, keychainPath, temporaryDirectory, originalKeychains, keychainWasAdded) {
  var cleanupFailed = false
  if (keychainWasAdded) {
    try {
      runSecurity(['list-keychains', '-d', 'user', '-s', ...originalKeychains])
    } catch {
      cleanupFailed = true
    }
  }
  if (existsSync(keychainPath)) {
    try {
      runSecurity(['delete-keychain', keychainPath])
    } catch {
      cleanupFailed = true
    }
  }
  rmSync(temporaryDirectory, { recursive: true, force: true })
  if (cleanupFailed) throw new Error('The temporary signing keychain could not be fully removed.')
}

function installedIdentityEnvironment(environment) {
  const buildEnvironment = { ...environment, CSC_IDENTITY_AUTO_DISCOVERY: 'true' }
  delete buildEnvironment.CSC_LINK
  delete buildEnvironment.CSC_KEY_PASSWORD
  delete buildEnvironment.CSC_NAME

  return { environment: buildEnvironment, cleanup() {} }
}

function importedIdentityEnvironment(environment, options) {
  if (!environment.CSC_LINK) throw new Error('--import-signing-cert requires CSC_LINK.')
  if (!environment.CSC_KEY_PASSWORD) throw new Error('--import-signing-cert requires CSC_KEY_PASSWORD.')

  const runSecurity = options.runSecurity ?? runSecurityCommand
  const createTemporaryDirectory = options.createTemporaryDirectory ?? function createSigningDirectory() {
    return mkdtempSync(join(tmpdir(), 'bespok3d-signing-'))
  }
  const keychainPassword = options.generateKeychainPassword?.() ?? randomBytes(32).toString('hex')
  const temporaryDirectory = createTemporaryDirectory()
  const keychainPath = join(temporaryDirectory, 'signing.keychain-db')
  const originalKeychains = existingKeychains(runSecurity(['list-keychains', '-d', 'user']))
  var keychainWasAdded = false

  try {
    runSecurity(['create-keychain', '-p', keychainPassword, keychainPath])
    runSecurity(['set-keychain-settings', '-lut', '21600', keychainPath])
    runSecurity(['unlock-keychain', '-p', keychainPassword, keychainPath])
    runSecurity([
      'import', environment.CSC_LINK, '-k', keychainPath, '-P', environment.CSC_KEY_PASSWORD,
      '-T', '/usr/bin/codesign', '-T', '/usr/bin/productbuild',
    ])
    runSecurity(['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', keychainPassword, keychainPath])
    runSecurity(['list-keychains', '-d', 'user', '-s', keychainPath, ...originalKeychains])
    keychainWasAdded = true
    const buildEnvironment = {
      ...environment,
      CSC_IDENTITY_AUTO_DISCOVERY: 'true',
      CSC_NAME: signingIdentity(keychainPath, runSecurity),
    }
    delete buildEnvironment.CSC_LINK
    delete buildEnvironment.CSC_KEY_PASSWORD

    return {
      environment: buildEnvironment,
      cleanup() {
        restoreSigningKeychain(runSecurity, keychainPath, temporaryDirectory, originalKeychains, keychainWasAdded)
      },
    }
  } catch {
    try {
      restoreSigningKeychain(runSecurity, keychainPath, temporaryDirectory, originalKeychains, keychainWasAdded)
    } catch {
      throw new Error('The signing certificate import failed and its temporary keychain cleanup failed.')
    }

    throw new Error('The macOS signing certificate could not be imported into the temporary keychain.')
  }
}

export function prepareMacSigning(environment, options = {}) {
  const platform = options.platform ?? process.platform
  const importCertificate = options.importCertificate === true
  if (!importCertificate) return installedIdentityEnvironment(environment)
  if (platform !== 'darwin') throw new Error('--import-signing-cert is available only on macOS.')

  return importedIdentityEnvironment(environment, options)
}
