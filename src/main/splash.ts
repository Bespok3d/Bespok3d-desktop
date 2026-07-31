// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { app, BrowserWindow } from 'electron'

// The window shown while the renderer boots. It names the build the user is about to look at, so a
// dev run, an installed release and an OTA-updated release are told apart before the app opens.

const SPLASH_BG = '#161c24'

export function splashDocument(appName: string, appVersion: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${SPLASH_BG};display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;user-select:none;-webkit-user-select:none}
h1{font-size:26px;font-weight:700;letter-spacing:-0.4px}
.version{margin-top:6px;font-size:12px;opacity:0.5}
.loading{margin-top:12px;font-size:11px;opacity:0.3}
</style></head><body><h1>${appName}</h1><p class="version">${appVersion}</p><p class="loading">Loading…</p></body></html>`
}

export function createSplash(appName: string): BrowserWindow {
  const splash = new BrowserWindow({
    width: 340,
    height: 180,
    frame: false,
    center: true,
    resizable: false,
    backgroundColor: SPLASH_BG,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  const document = encodeURIComponent(splashDocument(appName, app.getVersion()))
  splash.loadURL(`data:text/html;charset=utf-8,${document}`)

  return splash
}
