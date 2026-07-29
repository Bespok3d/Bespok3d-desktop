# Connect a GitHub account

**Owner:** the app repo (`Bespok3d-desktop`).

**Also touches:** nothing outside its owner.

**As a** Bespok3d user, **I want** to link my GitHub account to the app, **so that** the app can create and manage repos on my behalf for key publishing and plugin distribution.

## Acceptance criteria

- [x] Settings → Git Host shows a "Connect GitHub" button when no account is connected
- [x] Clicking it starts the GitHub Device Flow (the git-host sign-in decision): the app shows a code and a URL; the user opens the URL in a browser and enters the code
- [x] The UI polls for completion and updates automatically when the user authorizes in the browser
- [x] After authorization, the pane shows the connected GitHub username and avatar (or username + green indicator)
- [x] The access token is stored in the OS keychain via Electron `safeStorage`; it is never written to disk in plaintext
- [x] The connection persists across app restarts
- [x] A "Disconnect" button removes the stored token and resets the pane to the unconnected state

## Flags

> ❓ **UNCLEAR** - The required GitHub OAuth scopes are not documented. At minimum the app needs `repo` (to create repos and upload files). Does it also need `read:user` to show the username? Are there cases where `public_repo` would be sufficient?

> ❓ **UNCLEAR** - If the user's GitHub token expires or is revoked, the app silently fails on git host operations. There is no token refresh flow (Device Flow tokens do not expire by default, but they can be revoked). What error UX is shown?
