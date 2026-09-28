// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareMacSigning, runSecurityCommand } from '../mac-signing.mjs'

const temporaryRoot = mkdtempSync(join(tmpdir(), 'bespok3d-mac-signing-test-'))
const importedCertificate = '/fixture/Developer-ID.p12'
const certificatePassword = 'distinct-certificate-password'
const temporaryKeychainPassword = 'different-keychain-password'
const signingFingerprint = '0123456789ABCDEF0123456789ABCDEF01234567'

after(() => rmSync(temporaryRoot, { recursive: true, force: true }))

function keychainSecurityFixture(temporaryDirectory, failingCommand = null) {
  const commands = []
  function runSecurity(argumentsList) {
    commands.push(argumentsList)
    if (argumentsList[0] === failingCommand) throw new Error(`fixture failure contains ${certificatePassword}`)
    if (argumentsList[0] === 'list-keychains' && !argumentsList.includes('-s')) return '"login.keychain-db"\n'
    if (argumentsList[0] === 'create-keychain') writeFileSync(argumentsList[3], 'fixture keychain')
    if (argumentsList[0] === 'find-identity') {
      return `1) ${signingFingerprint} "Developer ID Application: Fixture (ABC1234567)"\n1 valid identities found\n`
    }

    return ''
  }

  return {
    commands,
    options: {
      platform: 'darwin',
      runSecurity,
      createTemporaryDirectory: () => temporaryDirectory,
      generateKeychainPassword: () => temporaryKeychainPassword,
    },
  }
}

test('the default Mac route uses the installed identity without a CSC P12 import', () => {
  const signing = prepareMacSigning({
    CSC_LINK: importedCertificate,
    CSC_KEY_PASSWORD: certificatePassword,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
  }, { platform: 'darwin' })

  assert.equal(signing.environment.CSC_LINK, undefined)
  assert.equal(signing.environment.CSC_KEY_PASSWORD, undefined)
  assert.equal(signing.environment.CSC_IDENTITY_AUTO_DISCOVERY, 'true')
})

test('an explicit certificate import uses its password only for import and the new keychain password for ACLs', () => {
  const temporaryDirectory = mkdtempSync(join(temporaryRoot, 'import-'))
  const fixture = keychainSecurityFixture(temporaryDirectory)
  const signing = prepareMacSigning({
    CSC_LINK: importedCertificate,
    CSC_KEY_PASSWORD: certificatePassword,
  }, { ...fixture.options, importCertificate: true })
  const keychainCreation = fixture.commands.find((argumentsList) => argumentsList[0] === 'create-keychain')
  const certificateImport = fixture.commands.find((argumentsList) => argumentsList[0] === 'import')
  const partitionList = fixture.commands.find((argumentsList) => argumentsList[0] === 'set-key-partition-list')

  assert.equal(keychainCreation[2], temporaryKeychainPassword)
  assert.equal(certificateImport[5], certificatePassword)
  assert.equal(partitionList[partitionList.indexOf('-k') + 1], temporaryKeychainPassword)
  assert.notEqual(certificateImport[5], partitionList[partitionList.indexOf('-k') + 1])
  assert.equal(signing.environment.CSC_LINK, undefined)
  assert.equal(signing.environment.CSC_KEY_PASSWORD, undefined)
  assert.equal(signing.environment.CSC_NAME, signingFingerprint)

  signing.cleanup()

  assert.equal(existsSync(temporaryDirectory), false)
  assert.ok(fixture.commands.some((argumentsList) => argumentsList[0] === 'delete-keychain'))
})

test('an explicit import without both certificate credentials is refused before keychain access', () => {
  const temporaryDirectory = mkdtempSync(join(temporaryRoot, 'missing-'))
  const fixture = keychainSecurityFixture(temporaryDirectory)

  assert.throws(() => prepareMacSigning({ CSC_LINK: importedCertificate }, { ...fixture.options, importCertificate: true }), /CSC_KEY_PASSWORD/)
  assert.deepEqual(fixture.commands, [])
  rmSync(temporaryDirectory, { recursive: true, force: true })
})

test('an import failure removes its temporary keychain without exposing its certificate password', () => {
  const temporaryDirectory = mkdtempSync(join(temporaryRoot, 'failed-import-'))
  const fixture = keychainSecurityFixture(temporaryDirectory, 'import')

  assert.throws(() => prepareMacSigning({
    CSC_LINK: importedCertificate,
    CSC_KEY_PASSWORD: certificatePassword,
  }, { ...fixture.options, importCertificate: true }), (error) => {
    assert.match(error.message, /could not be imported/)
    assert.doesNotMatch(error.message, new RegExp(certificatePassword))

    return true
  })
  assert.equal(existsSync(temporaryDirectory), false)
})

test('macOS security command errors never echo arguments or tool output', () => {
  assert.throws(() => runSecurityCommand(['import', importedCertificate, '-P', certificatePassword], () => {
    throw new Error(`security rejected ${certificatePassword}`)
  }), (error) => {
    assert.equal(error.message, 'A macOS signing-keychain operation failed.')
    assert.doesNotMatch(error.message, new RegExp(certificatePassword))

    return true
  })
})
