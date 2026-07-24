import { shell } from 'electron'
import { save } from '../keychain'
import { onAuthCallback } from '../../protocol'
import { createPkceChallenge, buildAuthorizeUrl, buildTokenExchangeBody, isCallbackValid } from './pkce'
import type { ConnectionRequest } from '../connector'

export const GITHUB_KEYCHAIN_KEY = 'github-token'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'

type JsonObject = Record<string, unknown>

async function pollDeviceCode(code: string, clientId: string): Promise<string | null> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, device_code: code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
  })
  if (!response.ok) return null
  const data = (await response.json()) as JsonObject
  if (data.access_token) return String(data.access_token)

  return null
}

export function makeGitHubDeviceFlow(clientId: string) {
  var pendingDeviceCode: string | null = null
  var pendingInterval = 5

  async function beginConnect(): Promise<ConnectionRequest> {
    const response = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, scope: 'repo' }),
    })
    if (!response.ok) throw new Error(`GitHub device code request: ${response.status}`)
    const data = (await response.json()) as JsonObject
    pendingDeviceCode = String(data.device_code)
    pendingInterval = Number(data.interval) || 5

    return {
      type: 'device-flow',
      userCode: String(data.user_code),
      verificationUrl: String(data.verification_uri),
      expiresAt: new Date(Date.now() + Number(data.expires_in) * 1000),
    }
  }

  async function waitForAuthorization(request: ConnectionRequest): Promise<void> {
    const intervalMs = pendingInterval * 1000
    // eslint-disable-next-line no-restricted-syntax -- bounded device-flow poll: terminates at token expiry; a recursive rewrite reads worse for a fixed-interval wait-until-deadline
    while (Date.now() < request.expiresAt.getTime()) {
      await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
      const code = pendingDeviceCode
      if (!code) return
      const token = await pollDeviceCode(code, clientId)
      if (!token) continue
      save(GITHUB_KEYCHAIN_KEY, token)
      pendingDeviceCode = null

      return
    }
    throw new Error('GitHub authorization timed out')
  }

  return { beginConnect, waitForAuthorization }
}

// One-shot wait for the b3d://auth/callback deep link, with a timeout so a cancelled browser sign-in
// never hangs the connect. Clears the handler either way so a later callback cannot resolve a stale wait.
function awaitAuthCallback(timeoutMs: number): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { onAuthCallback(null); reject(new Error('GitHub authorization timed out')) }, timeoutMs)
    onAuthCallback((params) => { clearTimeout(timer); onAuthCallback(null); resolve(params) })
  })
}

async function exchangePkceCode(exchangeUrl: string, clientId: string, code: string, verifier: string): Promise<string> {
  const response = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(buildTokenExchangeBody(clientId, code, verifier)),
  })
  if (!response.ok) throw new Error(`GitHub token exchange: ${response.status}`)
  const data = (await response.json()) as JsonObject
  if (!data.access_token) throw new Error('GitHub token exchange returned no access_token')

  return String(data.access_token)
}

// DORMANT (built for the next release; device flow stays the default). The full Authorization-Code +
// PKCE connect: open the consent page, catch the b3d://auth/callback, validate state, exchange the
// code for a token. `exchangeUrl` is the broker (or GitHub direct) that completes the exchange -- see
// pkce.ts on why a confidential-client secret lives server-side, not here.
/** @public - dormant ADR-0023 seam, intentionally unwired until the next release flips it on. */
export async function connectWithPkce(clientId: string, exchangeUrl: string): Promise<void> {
  const challenge = createPkceChallenge()
  await shell.openExternal(buildAuthorizeUrl(clientId, challenge))
  const params = await awaitAuthCallback(120_000)
  if (!isCallbackValid(params, challenge.state)) throw new Error('GitHub authorization was rejected')
  save(GITHUB_KEYCHAIN_KEY, await exchangePkceCode(exchangeUrl, clientId, params.code, challenge.verifier))
}
