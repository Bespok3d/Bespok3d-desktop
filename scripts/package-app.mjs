// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { channelFor, liveVersion, versionForChannel, versionLabelError } from './channels.mjs'
import { prepareMacSigning } from './mac-signing.mjs'

const [buildFlavor, ...providedBuilderArguments] = process.argv.slice(2)
const IMPORT_SIGNING_CERTIFICATE = '--import-signing-cert'

function packageArguments(argumentsList) {
  return {
    importSigningCertificate: argumentsList.includes(IMPORT_SIGNING_CERTIFICATE),
    builderArguments: argumentsList.filter((argument) => argument !== IMPORT_SIGNING_CERTIFICATE),
  }
}

function runBuildStep(command, argumentsList, environment) {
  const result = spawnSync(command, argumentsList, { env: environment, stdio: 'inherit' })
  if (result.error) throw result.error

  return result.status ?? 1
}

function main() {
  if (!buildFlavor) throw new Error('Usage: package-app.mjs <development|staging|live> [electron-builder arguments]')

  const channel = channelFor(buildFlavor)
  const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'))
  const liveBaseVersion = liveVersion(process.env.B3D_LIVE_VERSION ?? packageJson.version)
  const buildVersion = process.env.B3D_VERSION ?? versionForChannel(buildFlavor, liveBaseVersion)
  const { importSigningCertificate, builderArguments } = packageArguments(providedBuilderArguments)
  const publishedCut = process.env.B3D_PUBLISHED_CUT === 'true'
  if (importSigningCertificate && process.platform !== 'darwin') {
    throw new Error('--import-signing-cert can only be used on macOS.')
  }
  const labelError = publishedCut ? versionLabelError(buildFlavor, buildVersion) : null
  if (labelError) throw new Error(labelError)

  const buildEnvironment = {
    ...process.env,
    B3D_CHANNEL: channel.buildFlavor,
    B3D_LIVE_VERSION: liveBaseVersion,
    B3D_VERSION: buildVersion,
  }
  if (!buildEnvironment.REGISTRY_SIGNING_KEY && buildEnvironment.BESPOK3D_REGISTRY_SIGNING_KEY) {
    buildEnvironment.REGISTRY_SIGNING_KEY = buildEnvironment.BESPOK3D_REGISTRY_SIGNING_KEY
  }
  if (publishedCut) buildEnvironment.B3D_RELEASE = '1'
  else delete buildEnvironment.B3D_RELEASE

  const macSigning = prepareMacSigning(buildEnvironment, { importCertificate: importSigningCertificate })
  try {
    const packStatus = runBuildStep('sh', [resolve('scripts/pack-plugins.sh')], macSigning.environment)
    if (packStatus !== 0) return packStatus

    const electronViteCli = resolve('node_modules/electron-vite/bin/electron-vite.js')
    const buildStatus = runBuildStep(process.execPath, [electronViteCli, 'build'], macSigning.environment)
    if (buildStatus !== 0) return buildStatus

    const builderCli = resolve('node_modules/electron-builder/cli.js')
    const builderConfig = resolve('scripts/electron-builder.config.mjs')

    return runBuildStep(process.execPath, [builderCli, '--config', builderConfig, ...builderArguments], macSigning.environment)
  } finally {
    macSigning.cleanup()
  }
}

try {
  process.exitCode = main()
} catch (error) {
  console.error(`Packaging failed: ${error.message}`)
  process.exitCode = 1
}
