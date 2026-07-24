import { describe, it, expect } from 'vitest'
import { gitHubMissingRepoScope } from './account'
import type { TokenInfo } from '../../../../../../main/git-host/connector'

function token(scopes: string[]): TokenInfo {
  return { type: 'device-flow', scopes, expiresAt: null }
}

describe('gitHubMissingRepoScope', () => {
  it('flags a GitHub token that lacks the repo scope (old public_repo connect)', () => {
    expect(gitHubMissingRepoScope(token(['public_repo']), true)).toBe(true)
  })

  it('is clear once the token carries the repo scope', () => {
    expect(gitHubMissingRepoScope(token(['repo']), true)).toBe(false)
  })

  it('never flags a non-GitHub (Gitea PAT) connection', () => {
    expect(gitHubMissingRepoScope(token([]), false)).toBe(false)
  })

  it('does not flag when there is no token yet', () => {
    expect(gitHubMissingRepoScope(null, true)).toBe(false)
  })
})
