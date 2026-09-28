// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync, mkdirSync, writeFileSync, realpathSync, lstatSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { command, git, digest, assertEqual } from './release-io.mjs'
import { channelFor } from './channels.mjs'

export async function prepareWebsite(plan, services, execute = command) {
  const website = plan.website
  assertEqual(git(website.checkout, ['rev-parse', 'HEAD']), website.sourceCommit, 'website source commit')
  const source = resolve(website.checkout, website.directory)
  if (isAbsolute(website.directory) || relative(website.checkout, source).split('/').includes('..')) throw new Error('website directory must be inside its checkout')
  const localIndex = websiteIndex(website, source)
  const indexPath = `${website.directory}/index.html`
  if (git(website.checkout, ['status', '--porcelain', '--', '.', `:(exclude)${indexPath}`])) throw new Error('website source checkout has unrelated changes')
  if (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID) throw new Error('website deployment credentials missing')
  assertEqual(process.env.CLOUDFLARE_ACCOUNT_ID, website.accountId, 'website account')
  const response = await (services.deploymentFetch ?? fetch)(`https://api.cloudflare.com/client/v4/accounts/${website.accountId}/pages/projects/${website.project}`, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` } })
  const metadata = await response.json()
  if (!response.ok || !metadata.success) throw new Error('website project permission unavailable')
  execute('npx', ['--no-install', 'wrangler', '--version'], { cwd: website.checkout })
  const current = execFileSync('git', ['-C', website.checkout, 'show', `${website.sourceCommit}:${indexPath}`])
  const destination = join(services.scratch, 'website')
  websiteSnapshot(website, destination)
  writeFileSync(join(destination, 'index.html'), current)
  command('node', [join(plan.app.checkout, 'scripts/update-web-downloads.mjs'), join(destination, 'index.html'), plan.liveVersion, join(plan.app.checkout, 'dist/release'), channelFor('live').releaseRepository])
  const expected = readFileSync(join(destination, 'index.html'))
  if (![digest(current), digest(expected)].includes(digest(readFileSync(localIndex)))) throw new Error('local website has unexpected download changes')
  const before = await services.http.bytes(website.url)
  const observed = digest(before)
  if (![digest(current), digest(expected)].includes(observed)) throw new Error('served website changed from approved source')
  return { ...website, destination, source, previousSha256: digest(current), expectedSha256: digest(expected), expected }
}

function websiteSnapshot(website, destination) {
  const tree = `${website.sourceCommit}:${website.directory}`
  const modes = git(website.checkout, ['ls-tree', '-r', '--format=%(objectmode)', tree]).split('\n')
  if (modes.includes('120000')) throw new Error('website snapshot cannot contain symlinks')
  const archive = execFileSync('git', ['-C', website.checkout, 'archive', '--format=tar', tree], { maxBuffer: 256 * 1024 * 1024 })
  mkdirSync(destination, { recursive: true })
  execFileSync('tar', ['-xf', '-', '-C', destination], { input: archive })
}

export async function inspectWebsite(website, services) {
  const served = digest(await services.http.bytes(website.url))
  if (served === website.expectedSha256) return 'equivalent'
  if (served === website.previousSha256) return 'absent'
  throw new Error('unexpected served website content; refusing overwrite')
}

export function deployWebsite(website, execute = command) {
  const index = websiteIndex(website, website.source)
  if (![website.previousSha256, website.expectedSha256].includes(digest(readFileSync(index)))) throw new Error('local website changed after preflight')
  writeFileSync(index, website.expected)
  execute('npx', ['--no-install', 'wrangler', 'pages', 'deploy', website.destination, '--project-name', website.project], { cwd: website.source, stdio: 'inherit' })
}

function websiteIndex(website, source) {
  const expectedSource = resolve(realpathSync(website.checkout), website.directory)
  if (realpathSync(source) !== expectedSource) throw new Error('local website directory is a symlink')
  const index = join(source, 'index.html')
  if (!lstatSync(index).isFile() || realpathSync(index) !== join(expectedSource, 'index.html')) throw new Error('local website index must be a regular file without symlinks')
  return index
}
