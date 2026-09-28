// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { releaseArtifacts, releaseInstallers, updaterFeeds, assetName } from '../release-manifest.mjs'
import { versionForChannel } from '../channels.mjs'
import { electronBuilderConfig } from '../electron-builder.config.mjs'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const releaseScript = join(repositoryRoot, 'scripts', 'release.sh')
const fixtureRoot = mkdtempSync(join(tmpdir(), 'b3d-release-targets-'))
const fixtureDriver = join(fixtureRoot, 'driver.mjs')
const stubDirectory = join(fixtureRoot, 'bin')
const repositoryVersion = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8')).version
const liveVersion = repositoryVersion
const stagingVersion = versionForChannel('staging', liveVersion)
const builtSourceSha = 'a'.repeat(40)
const publishCheckoutSha = 'b'.repeat(40)

function nextPatchVersion(version) {
  const [releaseTriple, ...releaseLabels] = version.split('-')
  const [major, minor, patch] = releaseTriple.split('.').map(Number)
  const nextTriple = `${major}.${minor}.${patch + 1}`

  return releaseLabels.length > 0 ? `${nextTriple}-${releaseLabels.join('-')}` : nextTriple
}

const nextPatchLiveVersion = nextPatchVersion(liveVersion)

after(() => rmSync(fixtureRoot, { recursive: true, force: true }))

function createStub(name, body) {
  const stubPath = join(stubDirectory, name)
  writeFileSync(stubPath, `#!/bin/sh\n${body}\n`)
  chmodSync(stubPath, 0o755)
}

function writeFixtureDriver() {
  const driverSource = `
import { appendFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { releaseArtifacts, releaseInstallers, updaterFeeds, assetName } from ${JSON.stringify(new URL('../release-manifest.mjs', import.meta.url).href)}
const [command, ...argumentsList] = process.argv.slice(2)
const outputDirectory = process.env.B3D_OUTPUT_DIRECTORY
function log(message) { appendFileSync(process.env.B3D_COMMAND_LOG, message + '\\n') }
function makeOutput(target, version) {
  mkdirSync(outputDirectory, { recursive: true })
  const installers = releaseInstallers(version, target)
  releaseArtifacts(version, target).forEach((artifact) => {
    if (artifact.built === process.env.B3D_FIXTURE_SKIP_ARTIFACT) return
    const feedContents = updaterFeeds(target).includes(artifact.built)
      ? [
          'version: ' + version,
          'files:',
          '  - url: ' + assetName(installers[0].built),
          '    size: 1',
          'path: ' + assetName(installers[0].built),
          '',
        ].join('\\n')
      : 'fixture artifact'
    writeFileSync(join(outputDirectory, artifact.built), feedContents)
  })
}
if (command === 'npm') {
  const target = process.env.B3D_CHANNEL
  const version = process.env.B3D_VERSION
  log(JSON.stringify({ command, target, version, args: argumentsList }))
  makeOutput(target, version)
}
if (command === 'git') {
  if (argumentsList.includes('branch')) process.stdout.write(process.env.B3D_FIXTURE_BRANCH ?? 'dev')
  if (argumentsList.includes('status')) process.stdout.write(process.env.B3D_FIXTURE_DIRTY ?? '')
  if (argumentsList.includes('rev-parse')) process.stdout.write((process.env.B3D_FIXTURE_GIT_COMMIT ?? '0123456789abcdef0123456789abcdef01234567') + '\\n')
  if (['add', 'commit', 'push'].some((operation) => argumentsList.includes(operation))) log(JSON.stringify({ command, args: argumentsList }))
}
if (command === 'gh') {
  log(JSON.stringify({ command, args: argumentsList }))
  if (argumentsList[0] === 'repo' && argumentsList[1] === 'view') {
    if (process.env.B3D_FIXTURE_MISSING_HOST === 'true') {
      process.stderr.write('fixture release host is unavailable\\n')
      process.exit(1)
    }
    process.stdout.write('staging-main\\n')
    process.exit(0)
  }
  if (argumentsList[0] === 'api') {
    process.stdout.write((process.env.B3D_FIXTURE_REMOTE_STATUS ?? 'ahead') + '\\n')
    process.exit(0)
  }
  if (argumentsList[0] === 'release' && argumentsList[1] === 'view' && argumentsList.includes('--json')) {
    const tag = argumentsList[2]
    const version = tag.slice(1)
    const target = version.endsWith('-staging') ? 'staging' : 'live'
    const assets = releaseArtifacts(version, target).map((artifact) => ({
      name: assetName(artifact.built),
      size: statSync(join(outputDirectory, artifact.built)).size,
    }))
    process.stdout.write(JSON.stringify(assets))
    process.exit(0)
  }
  if (argumentsList[0] === 'release' && argumentsList[1] === 'view') process.exit(1)
}
`
  writeFileSync(fixtureDriver, driverSource)
}

function prepareFixtures() {
  mkdirSync(stubDirectory, { recursive: true })
  writeFixtureDriver()
  createStub('npm', `exec node "$B3D_FIXTURE_DRIVER" npm "$@"`)
  createStub('gh', `exec node "$B3D_FIXTURE_DRIVER" gh "$@"`)
  createStub('git', `exec node "$B3D_FIXTURE_DRIVER" git "$@"`)
  createStub('uname', 'printf "Darwin\\n"')
  createStub('flatpak-builder', 'exit 0')
}

function runRelease(argumentsList, options = {}) {
  const runRoot = mkdtempSync(join(fixtureRoot, 'run-'))
  const commandLog = join(runRoot, 'commands.log')
  const outputDirectory = options.outputDirectory ?? join(runRoot, 'output')
  const packageJsonPath = join(runRoot, 'package.json')
  const packageLockPath = join(runRoot, 'package-lock.json')
  const liveVersionValue = options.liveVersion ?? repositoryVersion
  writeFileSync(commandLog, '')
  writeFileSync(packageJsonPath, JSON.stringify({ version: liveVersionValue }))
  writeFileSync(packageLockPath, JSON.stringify({ version: liveVersionValue, packages: { '': { version: liveVersionValue } } }))
  seedReleaseArtifacts(outputDirectory, options.seedTarget, liveVersionValue)
  seedBuildProvenance(outputDirectory, options.seedTarget, liveVersionValue, options.buildSourceCommit)
  const environment = {
    ...process.env,
    PATH: `${stubDirectory}:${process.env.PATH}`,
    B3D_FIXTURE_DRIVER: fixtureDriver,
    B3D_COMMAND_LOG: commandLog,
    B3D_OUTPUT_DIRECTORY: outputDirectory,
    B3D_RELEASE_OUTPUT_DIR: outputDirectory,
    B3D_RELEASE_PACKAGE_JSON: packageJsonPath,
    B3D_RELEASE_PACKAGE_LOCK_JSON: packageLockPath,
    B3D_FIXTURE_SKIP_ARTIFACT: options.skipArtifact ?? '',
    B3D_FIXTURE_GIT_COMMIT: options.gitCommit ?? '0123456789abcdef0123456789abcdef01234567',
    BESPOK3D_DESKTOP_APP_PUBLISH_GH_TOKEN: 'fixture-token-not-real',
    CSC_LINK: '/fixture/should-not-be-imported.p12',
    CSC_KEY_PASSWORD: 'fixture-certificate-password',
    ...options.environment,
  }
  const attempt = options.spawn
    ? options.spawn(argumentsList, environment)
    : requireSpawn(argumentsList, environment)

  return {
    ...attempt,
    output: `${attempt.stdout ?? ''}${attempt.stderr ?? ''}`,
    commands: readFileSync(commandLog, 'utf8').split('\n').filter(Boolean).map(JSON.parse),
    packageJsonPath,
    packageLockPath,
    outputDirectory,
  }
}

function seedBuildProvenance(outputDirectory, target, liveVersionValue, sourceCommit) {
  if (!target) return
  const appVersion = versionForChannel(target, liveVersionValue)
  const publishTarget = electronBuilderConfig(target).publish[0]
  const evidencePath = join(outputDirectory, `.release-provenance-v${appVersion}.json`)
  if (existsSync(evidencePath)) return
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(evidencePath, JSON.stringify({
    tag: `v${appVersion}`,
    appVersion,
    releaseTarget: target,
    releaseRepository: `${publishTarget.owner}/${publishTarget.repo}`,
    sourceCommit: sourceCommit ?? '0123456789abcdef0123456789abcdef01234567',
    hostCommit: null,
  }, null, 2))
}

function seedReleaseArtifacts(outputDirectory, target, liveVersionValue) {
  if (!target) return
  const version = versionForChannel(target, liveVersionValue)
  const installers = releaseInstallers(version, target)
  mkdirSync(outputDirectory, { recursive: true })
  releaseArtifacts(version, target).forEach((artifact) => {
    const contents = updaterFeeds(target).includes(artifact.built)
      ? [
          `version: ${version}`,
          'files:',
          `  - url: ${assetName(installers[0].built)}`,
          '    size: 1',
          `path: ${assetName(installers[0].built)}`,
          '',
        ].join('\n')
      : 'prebuilt fixture asset'
    writeFileSync(join(outputDirectory, artifact.built), contents)
  })
}

function requireSpawn(argumentsList, environment) {
  return spawnSync('bash', [releaseScript, ...argumentsList], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
  })
}

import { spawnSync } from 'node:child_process'

prepareFixtures()

test('no target builds Live with its existing version and installed-identity signing path', () => {
  const result = runRelease([])
  const macBuild = result.commands.find((command) => command.command === 'npm' && command.args.includes('--mac'))

  assert.equal(result.status, 0, result.output)
  assert.ok(macBuild)
  assert.equal(macBuild.target, 'live')
  assert.equal(macBuild.version, liveVersion)
  assert.equal(macBuild.args.includes('--import-signing-cert'), false)
  assert.ok(result.output.includes(`Built live ${liveVersion}`))
})

test('the Staging target builds the compound app version without writing package.json', () => {
  const packageBytes = readFileSync(join(repositoryRoot, 'package.json'))
  const result = runRelease(['staging'])
  const macBuild = result.commands.find((command) => command.command === 'npm' && command.args.includes('--mac'))

  assert.equal(result.status, 0, result.output)
  assert.equal(macBuild.target, 'staging')
  assert.equal(macBuild.version, stagingVersion)
  assert.equal(readFileSync(join(repositoryRoot, 'package.json')).equals(packageBytes), true)
  assert.ok(result.output.includes(`Built staging ${stagingVersion}`))
})

test('the release command derives a compound Staging version from an isolated Live package version', () => {
  const result = runRelease(['staging'], { liveVersion: nextPatchLiveVersion })
  const macBuild = result.commands.find((command) => command.command === 'npm' && command.args.includes('--mac'))

  assert.equal(result.status, 0, result.output)
  assert.equal(macBuild.version, versionForChannel('staging', nextPatchLiveVersion))
  assert.equal(JSON.parse(readFileSync(result.packageJsonPath, 'utf8')).version, nextPatchLiveVersion)
})

test('channel build configuration uses one repository and distinct release kinds', () => {
  assert.deepEqual(electronBuilderConfig('live', liveVersion).publish[0], {
    provider: 'github', owner: 'Bespok3d', repo: 'Bespok3d-desktop', releaseType: 'release', channel: 'latest',
  })
  assert.deepEqual(electronBuilderConfig('staging', stagingVersion).publish[0], {
    provider: 'github', owner: 'Bespok3d', repo: 'Bespok3d-desktop', releaseType: 'prerelease', channel: 'bespok3d-staging',
  })
  assert.deepEqual(electronBuilderConfig('development').publish, [])
})

test('Staging publish-only targets its built desktop dev commit', () => {
  const build = runRelease(['staging'], { gitCommit: builtSourceSha })
  const evidencePath = join(build.outputDirectory, `.release-provenance-v${stagingVersion}.json`)
  assert.equal(build.status, 0, build.output)
  const dryRun = runRelease(['staging', 'publish', '--dry-run'], {
    outputDirectory: build.outputDirectory,
    gitCommit: publishCheckoutSha,
  })
  const evidenceAfterDryRun = JSON.parse(readFileSync(evidencePath, 'utf8'))
  const result = runRelease(['staging', 'publish'], {
    outputDirectory: build.outputDirectory,
    gitCommit: publishCheckoutSha,
  })
  const createRelease = result.commands.find((command) => command.command === 'gh' && command.args[0] === 'release' && command.args[1] === 'create')

  assert.equal(dryRun.status, 0, dryRun.output)
  assert.ok(dryRun.output.includes(`Source commit: ${builtSourceSha}`))
  assert.ok(!dryRun.output.includes(`Source checkout commit`))
  assert.equal(evidenceAfterDryRun.sourceCommit, builtSourceSha)
  assert.equal(evidenceAfterDryRun.hostCommit, null)
  assert.deepEqual(dryRun.commands, [])
  assert.equal(result.status, 0, result.output)
  assert.ok(createRelease)
  assert.ok(createRelease.args.includes('--prerelease=true'))
  assert.ok(createRelease.args.includes('--target'))
  assert.equal(createRelease.args[createRelease.args.indexOf('--target') + 1], builtSourceSha)
  assert.ok(result.commands.filter((command) => command.command === 'gh').every((command) =>
    command.args.some((argument) => argument.includes('Bespok3d/Bespok3d-desktop')),
  ))
  assert.match(result.output, new RegExp(`Source commit: ${builtSourceSha}`))
  assert.match(result.output, new RegExp(`Release host commit: ${builtSourceSha}`))
  assert.deepEqual(JSON.parse(readFileSync(join(result.outputDirectory, `.release-provenance-v${stagingVersion}.json`), 'utf8')), {
    tag: `v${stagingVersion}`,
    appVersion: stagingVersion,
    releaseTarget: 'staging',
    releaseRepository: 'Bespok3d/Bespok3d-desktop',
    sourceCommit: builtSourceSha,
    hostCommit: builtSourceSha,
  })
  const releaseAssetNames = createRelease.args.filter((argument) =>
    releaseArtifacts(stagingVersion, 'staging').some((artifact) => assetName(artifact.built) === basename(argument)),
  ).map((artifactPath) => basename(artifactPath)).sort()
  assert.deepEqual(releaseAssetNames, releaseArtifacts(stagingVersion, 'staging').map((artifact) => assetName(artifact.built)).sort())
  assert.ok(result.output.includes(`Publishing `) && result.output.includes(` staging ${stagingVersion} `) && result.output.includes(' as a prerelease'))
})

test('a Staging source absent from desktop dev stops before uploading', () => {
  const result = runRelease(['staging', 'publish'], {
    seedTarget: 'staging',
    environment: { B3D_FIXTURE_REMOTE_STATUS: 'behind' },
  })
  const releaseMutations = result.commands.filter((command) =>
    command.command === 'gh' && ['create', 'upload', 'edit'].includes(command.args[1]),
  )

  assert.notEqual(result.status, 0)
  assert.deepEqual(releaseMutations, [])
  assert.ok(result.commands.filter((command) => command.command === 'gh').every((command) =>
    command.args.some((argument) => argument.includes('Bespok3d/Bespok3d-desktop')),
  ))
})

test('one Staging bump/build/publish commits and pushes dev after building but before the prerelease', () => {
  const result = runRelease(['bump', 'staging', 'publish'])
  const actions = result.commands.filter((command) => command.command === 'git' || command.command === 'npm' || command.command === 'gh')
  const commitIndex = actions.findIndex((command) => command.command === 'git' && command.args.includes('commit'))
  const buildIndex = actions.findIndex((command) => command.command === 'npm')
  const pushIndex = actions.findIndex((command) => command.command === 'git' && command.args.includes('push'))
  const publishIndex = actions.findIndex((command) => command.command === 'gh' && command.args[1] === 'create')

  assert.equal(result.status, 0, result.output)
  assert.ok(commitIndex >= 0 && commitIndex < buildIndex)
  assert.ok(pushIndex > buildIndex && pushIndex < publishIndex)
  assert.equal(actions[publishIndex].args[actions[publishIndex].args.indexOf('--target') + 1], '0123456789abcdef0123456789abcdef01234567')
  assert.equal(JSON.parse(readFileSync(result.packageJsonPath, 'utf8')).version, nextPatchLiveVersion)
  const lock = JSON.parse(readFileSync(result.packageLockPath, 'utf8'))
  assert.equal(lock.version, nextPatchLiveVersion)
  assert.equal(lock.packages[''].version, nextPatchLiveVersion)
})

test('Staging bump dry-run names the complete target release even before the new files exist', () => {
  const result = runRelease(['bump', 'staging', 'publish', '--dry-run'])
  const targetVersion = versionForChannel('staging', nextPatchLiveVersion)

  assert.equal(result.status, 0, result.output)
  assert.deepEqual(result.commands, [])
  assert.ok(releaseArtifacts(targetVersion, 'staging').every((artifact) =>
    result.output.includes(`DRY-RUN would upload: ${assetName(artifact.built)}`),
  ))
})

test('a dirty desktop checkout is refused before bumping or publishing', () => {
  const result = runRelease(['bump', 'staging', 'publish'], { environment: { B3D_FIXTURE_DIRTY: ' M src/main/index.ts' } })
  assert.notEqual(result.status, 0)
  assert.match(result.output, /commit the desktop changes/)
  assert.deepEqual(result.commands, [])
})

test('Live publication stays a normal release and can update the website', () => {
  const websiteFile = join(fixtureRoot, 'live-index.html')
  writeFileSync(websiteFile, '<b id="rel-version">old</b>\n<!-- downloads:start -->\nold links\n<!-- downloads:end -->')
  const result = runRelease(['live', 'publish', 'web'], {
    seedTarget: 'live',
    environment: { BESPOK3D_WEB_INDEX: websiteFile },
  })
  const createRelease = result.commands.find((command) => command.command === 'gh' && command.args[0] === 'release' && command.args[1] === 'create')

  assert.equal(result.status, 0, result.output)
  assert.ok(createRelease.args.includes('--prerelease=false'))
  assert.equal(createRelease.args[createRelease.args.indexOf('--target') + 1], '0123456789abcdef0123456789abcdef01234567')
  assert.ok(result.commands.filter((command) => command.command === 'gh').every((command) =>
    command.args.some((argument) => argument.includes('Bespok3d/Bespok3d-desktop')),
  ))
  assert.ok(readFileSync(websiteFile, 'utf8').includes(liveVersion))
})

test('Staging plus web and the legacy pre flag are rejected before commands run', () => {
  const stagingWeb = runRelease(['staging', 'web'])
  const packageBefore = readFileSync(stagingWeb.packageJsonPath, 'utf8')
  const legacyPre = runRelease(['pre', 'publish'])

  assert.notEqual(stagingWeb.status, 0)
  assert.match(stagingWeb.output, /Staging cannot update the website/)
  assert.deepEqual(stagingWeb.commands, [])
  assert.equal(readFileSync(stagingWeb.packageJsonPath, 'utf8'), packageBefore)
  assert.notEqual(legacyPre.status, 0)
  assert.match(legacyPre.output, /replaced by the explicit 'staging' target/)
  assert.deepEqual(legacyPre.commands, [])
})

test('release target fixtures cover repeat, alternating, bump, dry-run, unknown and publish-only flows', () => {
  const repeatedStaging = runRelease(['staging'])
  const thenLive = runRelease(['live'])
  const stagingBump = runRelease(['staging', 'bump', '--dry-run'])
  const liveBump = runRelease(['live', 'bump', '--dry-run'])
  const dryRunOutputDirectory = join(fixtureRoot, 'dry-run-output')
  seedReleaseArtifacts(dryRunOutputDirectory, 'staging', repositoryVersion)
  const dryRun = runRelease(['staging', '--dry-run'], {
    outputDirectory: dryRunOutputDirectory,
    seedTarget: 'staging',
  })
  const stagingFeedPath = join(dryRunOutputDirectory, 'bespok3d-staging.yml')
  const stagingFeedBefore = readFileSync(stagingFeedPath, 'utf8')
  const unknownTarget = runRelease(['candidate'])
  const conflictingTargets = runRelease(['live', 'staging'])
  const publishOnly = runRelease(['staging', 'publish'], { seedTarget: 'staging' })

  assert.equal(repeatedStaging.status, 0, repeatedStaging.output)
  assert.equal(thenLive.status, 0, thenLive.output)
  assert.equal(stagingBump.status, 0, stagingBump.output)
  assert.ok(stagingBump.output.includes(`${liveVersion} -> ${nextPatchLiveVersion}`))
  assert.ok(stagingBump.output.includes(`staging ${versionForChannel('staging', nextPatchLiveVersion)}`))
  assert.ok(liveBump.output.includes(`DRY-RUN would build live ${nextPatchLiveVersion}`))
  assert.equal(dryRun.status, 0, dryRun.output)
  assert.ok(dryRun.output.includes(`DRY-RUN would build staging ${stagingVersion}`))
  assert.deepEqual(dryRun.commands, [])
  assert.equal(readFileSync(stagingFeedPath, 'utf8'), stagingFeedBefore)
  assert.notEqual(unknownTarget.status, 0)
  assert.deepEqual(unknownTarget.commands, [])
  assert.notEqual(conflictingTargets.status, 0)
  assert.match(conflictingTargets.output, /choose exactly one release target/)
  assert.deepEqual(conflictingTargets.commands, [])
  assert.deepEqual(dryRun.commands, [])
  assert.equal(publishOnly.commands.filter((command) => command.command === 'npm').length, 0)
})

test('a shared output directory cleans only the selected target and publishes no opposite-target artifacts', () => {
  const sharedOutput = join(fixtureRoot, 'shared-output')
  const stagingFlatpak = releaseArtifacts(stagingVersion, 'staging').find((artifact) => artifact.built.endsWith('.flatpak')).built
  seedReleaseArtifacts(sharedOutput, 'live', liveVersion)
  seedReleaseArtifacts(sharedOutput, 'staging', liveVersion)

  const incompleteStaging = runRelease(['staging'], { outputDirectory: sharedOutput, skipArtifact: stagingFlatpak })
  assert.notEqual(incompleteStaging.status, 0)
  assert.ok(incompleteStaging.output.includes(`Staging-${stagingVersion}-x86_64.flatpak was not built`))
  assert.equal(existsSync(join(sharedOutput, stagingFlatpak)), false)
  assert.equal(existsSync(join(sharedOutput, releaseArtifacts(liveVersion, 'live').find((artifact) => artifact.built.endsWith('.AppImage')).built)), true)

  const restoredStaging = runRelease(['staging'], { outputDirectory: sharedOutput })
  const liveAfterStaging = runRelease(['live'], { outputDirectory: sharedOutput })
  const stagingPublishOnly = runRelease(['staging', 'publish'], { outputDirectory: sharedOutput })
  const stagingCreate = stagingPublishOnly.commands.find((command) => command.command === 'gh' && command.args[0] === 'release' && command.args[1] === 'create')
  const publishedAssetNames = stagingCreate.args.filter((argument) =>
    releaseArtifacts(stagingVersion, 'staging').some((artifact) => assetName(artifact.built) === basename(argument)),
  ).map((artifactPath) => basename(artifactPath)).sort()

  assert.equal(restoredStaging.status, 0, restoredStaging.output)
  assert.equal(liveAfterStaging.status, 0, liveAfterStaging.output)
  assert.equal(stagingPublishOnly.status, 0, stagingPublishOnly.output)
  assert.deepEqual(publishedAssetNames, releaseArtifacts(stagingVersion, 'staging').map((artifact) => assetName(artifact.built)).sort())
})
