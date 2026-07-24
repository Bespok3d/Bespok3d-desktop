import { join } from 'path'
import { app } from 'electron'

// Resolves a path under Electron's per-user data dir, the home of every on-disk app store
// (printers/, keys/, settings.json, git-host.json, registry-cache.json, local-plugins/, keychain/,
// plugin-cache/). One place that knows where persisted state lives, so relocating it is one edit and
// no store reaches into `electron.app` for its own path.
export function userDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}
