// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Reading a file published beside a package - a README, the release notes - the way a visitor reads
// it: no account, no token, no Authorization header. The token is the last resort and only reaches a
// private repo's asset, and an anonymous read of a public one must not spend the signed-in user's own
// hourly ration either.
//
// A read the app makes on its own does not throw. Those are answered by a renderer that already has
// something to show (the copy the app shipped with), so a dead read is an answer carrying a reason,
// never a rejection: an unhandled rejection inside an IPC handler prints a stack trace in the main
// process log on every click, which says nothing to the person reading the log and nothing at all to
// the user. Fetching the package a user asked to install is the one read that does fail when it
// fails, because the install stops either way - but it fails saying what the person can do about it.
import { RegistryFetchError } from './model'
import type { SourceFailureReason } from './model'
import { httpGet, httpReason } from './resolve/request'
import { connectedToAGitHost } from './resolve/anonymous-avenues'
import { activeConnector } from '../git-host'
import type { AssetStat } from '../git-host/connector'

// What went wrong, in the reader's terms rather than the transport's: the host could not be reached
// at all, the file is behind a login, the host is rationing this machine, there is nothing at that
// address, or the read succeeded and brought back nothing.
export type AssetProblem = 'unreachable' | 'private' | 'ratelimited' | 'missing' | 'empty'

export interface AssetRead {
  text: string | null
  problem: AssetProblem | null
}

const ASSET_BYTES = { Accept: 'application/octet-stream' }

const PROBLEM_OF: Partial<Record<SourceFailureReason, AssetProblem>> = {
  network: 'unreachable',
  auth: 'private',
  ratelimited: 'ratelimited',
  notfound: 'missing',
  empty: 'empty',
}

function problemOf(failure: RegistryFetchError): AssetProblem {
  return PROBLEM_OF[failure.reason] ?? 'unreachable'
}

// A 200 that carries nothing is a failure with a name of its own. A page that swapped its bundled
// words for a blank tab would look broken, and "cannot reach GitHub" would be a lie about a read that
// arrived.
function asAssetRead(text: string): AssetRead {
  return text.trim().length === 0 ? { text: null, problem: 'empty' } : { text, problem: null }
}

async function anonymousAssetBytes(url: string): Promise<Buffer | RegistryFetchError> {
  const answered = await httpGet(url, ASSET_BYTES).catch((error: RegistryFetchError) => error)
  if (answered instanceof RegistryFetchError) return answered
  if (!answered.ok) return new RegistryFetchError(httpReason(answered), `asset ${answered.status}`)
  const bytes = Buffer.from(await answered.arrayBuffer())

  return bytes.length === 0 ? new RegistryFetchError('empty', 'the file came back with nothing in it') : bytes
}

async function anonymousAsset(url: string): Promise<AssetRead | RegistryFetchError> {
  const bytes = await anonymousAssetBytes(url)

  return bytes instanceof RegistryFetchError ? bytes : asAssetRead(bytes.toString('utf8'))
}

// The token rung, reached only when the public one is dead and there is a token to try. Its own
// failure is not reported: the user is told what the public read found, because that is the read
// everyone else's copy of the app will also make.
function authorizedAssetBytes(url: string): Promise<Buffer | null> {
  return Promise.resolve()
    .then(() => activeConnector().downloadReleaseAsset(url))
    .catch(() => null)
}

function authorizedAsset(url: string): Promise<AssetRead | null> {
  return authorizedAssetBytes(url).then((bytes) => (bytes === null ? null : asAssetRead(bytes.toString('utf8'))))
}

export async function readReleaseDoc(url: string): Promise<AssetRead> {
  const anonymous = await anonymousAsset(url)
  if (!(anonymous instanceof RegistryFetchError)) return anonymous
  const publicFailure: AssetRead = { text: null, problem: problemOf(anonymous) }
  if (!(await connectedToAGitHost())) return publicFailure

  return (await authorizedAsset(url)) ?? publicFailure
}

const NO_STAT: AssetStat = { downloadCount: null, publishedAt: null }

// The download count and upload date shown on a source row. Cosmetic detail on a row that renders
// fine without it, so a host that will not answer costs the row its two grey labels and nothing else.
export function readAssetStat(url: string): Promise<AssetStat> {
  return Promise.resolve()
    .then(() => activeConnector().assetInfo(url))
    .catch(() => NO_STAT)
}

// Installing is the one read a person asked for, so it stops when it cannot be done. What it says is
// the difference: 'Not connected to GitHub' told someone who never wanted a GitHub account that their
// missing account was the fault, when the package is public and the account was never needed.
const NO_PACKAGE: Record<AssetProblem, string> = {
  unreachable: 'GitHub could not be reached, so the plugin could not be downloaded. Check the connection and try again.',
  private: 'This plugin is not published publicly. Sign in with a GitHub account that can see it, then install again.',
  ratelimited: 'GitHub has stopped answering this computer for now. Try again later, or sign in to GitHub to raise the limit.',
  missing: 'The plugin file is no longer published at that address. The publisher may have removed the release.',
  empty: 'The plugin file downloaded from GitHub is empty, so there is nothing to install.',
}

// The package a user asked to install. A published plugin is a public file, so it downloads with no
// account; the account is tried only when the public route is dead and there is one to try, which is
// what reaches a plugin whose repo is private.
export async function readReleaseAsset(url: string): Promise<Buffer> {
  const anonymous = await anonymousAssetBytes(url)
  if (!(anonymous instanceof RegistryFetchError)) return anonymous
  const authorized = (await connectedToAGitHost()) ? await authorizedAssetBytes(url) : null
  if (authorized !== null) return authorized

  throw new Error(NO_PACKAGE[problemOf(anonymous)])
}
