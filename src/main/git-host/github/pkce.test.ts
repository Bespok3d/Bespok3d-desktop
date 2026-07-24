import { describe, it, expect } from 'vitest'
import { deriveChallenge, buildAuthorizeUrl, buildTokenExchangeBody, isCallbackValid, createPkceChallenge, B3D_AUTH_REDIRECT } from './pkce'

describe('pkce', () => {
  it('derives the S256 challenge per the RFC 7636 worked example', () => {
    // The verifier and expected challenge from RFC 7636 Appendix B.
    expect(deriveChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })

  it('builds an authorize URL with the b3d redirect, S256 method, and state', () => {
    const url = new URL(buildAuthorizeUrl('client-123', { verifier: 'v', challenge: 'chal', state: 'st8' }))
    expect(url.searchParams.get('client_id')).toBe('client-123')
    expect(url.searchParams.get('redirect_uri')).toBe(B3D_AUTH_REDIRECT)
    expect(url.searchParams.get('code_challenge')).toBe('chal')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe('st8')
  })

  it('builds a token-exchange body carrying the verifier and redirect, never a secret', () => {
    const body = buildTokenExchangeBody('client-123', 'the-code', 'the-verifier')
    expect(body).toEqual({ client_id: 'client-123', code: 'the-code', redirect_uri: B3D_AUTH_REDIRECT, code_verifier: 'the-verifier' })
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('accepts a callback only when the state matches and a code is present', () => {
    expect(isCallbackValid({ code: 'x', state: 'st8' }, 'st8')).toBe(true)
    expect(isCallbackValid({ code: 'x', state: 'other' }, 'st8')).toBe(false)
    expect(isCallbackValid({ state: 'st8' }, 'st8')).toBe(false)
  })

  it('generates a fresh verifier whose challenge matches its derivation', () => {
    const challenge = createPkceChallenge()
    expect(challenge.challenge).toBe(deriveChallenge(challenge.verifier))
    expect(challenge.state.length).toBeGreaterThan(0)
  })
})
