// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure helpers for the OAuth Authorization-Code + PKCE flow that the b3d://auth/callback deep link
// completes (ADR-0023 + ADR-0015). DORMANT in this release: the device flow stays the default connect
// path; this is built so the next release can switch the default with the redirect URI registered.
//
// NOTE: GitHub OAuth Apps are confidential clients -- the token exchange normally needs the
// client_secret, which a desktop app must not embed. The exchange endpoint is therefore a parameter:
// point it at a hosted broker (bespok3d-server) that holds the secret, or at GitHub directly if/when
// PKCE-without-secret is confirmed. The pure builders here are correct for either target.
import { createHash, randomBytes } from 'node:crypto'

export const B3D_AUTH_REDIRECT = 'b3d://auth/callback'
const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

export interface PkceChallenge {
  verifier: string
  challenge: string
  state: string
}

function base64Url(bytes: Buffer): string {
  return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Deterministic S256 derivation (RFC 7636): the only part worth unit-testing against a known vector.
export function deriveChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

export function createPkceChallenge(): PkceChallenge {
  const verifier = base64Url(randomBytes(32))

  return { verifier, challenge: deriveChallenge(verifier), state: base64Url(randomBytes(16)) }
}

export function buildAuthorizeUrl(clientId: string, challenge: PkceChallenge, scope = 'repo'): string {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: B3D_AUTH_REDIRECT,
    scope,
    state: challenge.state,
    code_challenge: challenge.challenge,
    code_challenge_method: 'S256',
  })

  return `${AUTHORIZE_URL}?${query.toString()}`
}

export function buildTokenExchangeBody(clientId: string, code: string, verifier: string): Record<string, string> {
  return { client_id: clientId, code, redirect_uri: B3D_AUTH_REDIRECT, code_verifier: verifier }
}

// The callback is trusted only if its state echoes the one we generated (CSRF guard) and it carries
// a code. A mismatch means the response was not for this attempt.
export function isCallbackValid(params: Record<string, string>, expectedState: string): boolean {
  return !!params.code && params.state === expectedState
}
