# Connect a Gitea instance

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to link a self-hosted Gitea instance to the app, **so that** I can use it for key publishing and plugin distribution without depending on GitHub.

## Acceptance criteria

- [x] Settings → Git Host offers a "Gitea" option alongside GitHub
- [x] Switching to Gitea shows a URL field (base URL of the Gitea instance) and a PAT (Personal Access Token) field
- [x] Clicking "Save" validates the connection by calling the Gitea API and confirms the account is reachable
- [x] After saving, the pane shows the connected Gitea username and the instance URL
- [x] The PAT is stored in the OS keychain via `safeStorage`; never written to disk in plaintext
- [x] A "Disconnect" button clears the token and URL

## Flags

> ⚠️ **CONFLICT** - The publisher-identity decision specifies that community trust tier requires a GitHub account (the lookup URL is `GET /repos/{github_username}/bespok3d-publisher/contents/{fingerprint}.asc` against the GitHub API). Gitea users publishing their key to a Gitea repo cannot reach community tier under that decision. They remain unknown (yellow). Is this intentional? If Gitea support is first-class, the lookup convention must be extended or trust tiers redefined for self-hosted hosts.

> ❓ **UNCLEAR** - The Gitea connector accepts any base URL. There is no validation that the URL points to a real Gitea instance vs. a GitHub Enterprise or plain HTTP host. What happens if the URL is wrong or the instance is unreachable?

> ❓ **UNCLEAR** - PAT rotation on Gitea requires the user to disconnect, create a new PAT on Gitea, and reconnect. There is no in-app PAT update flow. Is this acceptable?
