// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// OS-side glue for the `b3d://` scheme. Registration + extracting the URL from the three ways the OS
// delivers it (macOS `open-url`, Windows/Linux launch argv, and a second-instance argv when already
// running), then dispatching the parsed route. Auth callbacks are consumed by the PKCE waiter; every
// other route is forwarded to the renderer, which confirms before any state change (ADR-0023).
import { app } from 'electron'
import { parseB3dUrl, type B3dRoute } from './url'

var authCallbackHandler: ((params: Record<string, string>) => void) | null = null

type AuthCallbackHandler = (params: Record<string, string>) => void

const SCHEME = 'b3d'

// The PKCE flow registers its one-shot waiter here; main feeds it the b3d://auth/callback params.
export function onAuthCallback(handler: AuthCallbackHandler | null): void {
  authCallbackHandler = handler
}

export function b3dUrlsFromArgv(argv: string[]): string[] {
  return argv.filter((arg) => arg.startsWith(`${SCHEME}://`))
}

// Dev runs Electron through a script path, so the OS must be told the exact exec+args to relaunch
// for a b3d:// link; packaged builds register by bundle id / installer protocol entry.
export function registerB3dScheme(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [process.argv[1]])

    return
  }
  app.setAsDefaultProtocolClient(SCHEME)
}

export function dispatchB3dUrl(raw: string, forwardToRenderer: (route: B3dRoute) => void): void {
  const route = parseB3dUrl(raw)
  if (route.kind === 'auth-callback') return void authCallbackHandler?.(route.params)
  if (route.kind === 'unknown') return void console.warn(`[b3d] ignoring unhandled URL: ${route.raw}`)
  forwardToRenderer(route)
}
