// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { app, BrowserWindow, shell, nativeImage, screen } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { registerIpc } from './ipc'
import { stopMdnsScan } from './mdns'
import { closeAllPrintStateWatches } from './daemon-client/feeds/print-state'
import { closeAllPluginLogWatches } from './daemon-client/feeds/plugin-log'
import { startAutoUpdates } from './app-update'
import { installAppMenu } from './menu'
import { createSplash } from './splash'
import { addLocalPackages } from './registry/local'
import { registerB3dScheme, b3dUrlsFromArgv, dispatchB3dUrl } from './protocol'
import type { B3dRoute } from './protocol/url'

var mainWindow: BrowserWindow

// A .b3 opened from the OS (double-click on the registered file type) reaches the app two ways:
// macOS fires the 'open-file' event; Windows/Linux pass the path as a launch argument (and, if the app
// is already running, the OS starts a second instance whose argv we forward via 'second-instance').
// Early opens are queued and flushed once the renderer has loaded. local-store does the ingest; we
// only relay the result so the renderer can refresh + prompt.
const pendingDroppedFiles: string[] = []
// b3d:// URLs delivered before the renderer is ready (cold launch via a link) wait here, same as
// pendingDroppedFiles, and flush on did-finish-load.
const pendingB3dUrls: string[] = []

function b3FilesFromArgv(argv: string[]): string[] {
  return argv.filter((arg) => arg.toLowerCase().endsWith('.b3') && existsSync(arg))
}

function ingestDroppedFiles(paths: string[]): void {
  if (paths.length === 0) return
  const result = addLocalPackages(paths)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('localStore:added', result)
}

function rendererReady(): boolean {
  return !!mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isLoading()
}

function forwardB3dRoute(route: B3dRoute): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('b3d:open', route)
}

function handleB3dUrls(urls: string[]): void {
  if (!rendererReady()) return void pendingB3dUrls.push(...urls)
  urls.forEach((url) => dispatchB3dUrl(url, forwardB3dRoute))
}

registerB3dScheme()

// macOS delivers a b3d:// link as 'open-url'; Windows/Linux pass it in argv (handled below).
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleB3dUrls([url])
})

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWindow && !mainWindow.isDestroyed()) ingestDroppedFiles([filePath])
  else pendingDroppedFiles.push(filePath)
})

// One instance only: a second launch (e.g. double-clicking a .b3 while the app runs on Windows/Linux)
// forwards its argv here instead of opening a duplicate. A first launch may carry the file in argv too.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
    ingestDroppedFiles(b3FilesFromArgv(argv))
    handleB3dUrls(b3dUrlsFromArgv(argv))
  })
  pendingDroppedFiles.push(...b3FilesFromArgv(process.argv))
  pendingB3dUrls.push(...b3dUrlsFromArgv(process.argv))
}

// Dev runs unsigned, so give it its own profile + keychain item ("Bespok3d Dev Safe Storage"). Sharing
// the name with the signed release made the two fight over the same keychain ACL (re-prompt loop).
const APP_NAME = is.dev ? 'Bespok3d Dev' : 'Bespok3d'

app.setName(APP_NAME)
app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: app.getVersion() })

const PREFERRED_WIDTH = 1280

function createWindow(splash: BrowserWindow): void {
  const iconPath = join(__dirname, '../../resources/icons/icon.png')
  const workArea = screen.getPrimaryDisplay().workArea
  const width = Math.min(PREFERRED_WIDTH, workArea.width)
  const win = new BrowserWindow({
    width,
    height: workArea.height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  mainWindow = win

  win.on('ready-to-show', () => {
    splash.destroy()
    win.show()
  })

  // Flush anything queued before the renderer was ready (cold launch via Finder or a b3d:// link).
  win.webContents.on('did-finish-load', () => {
    ingestDroppedFiles(pendingDroppedFiles.splice(0))
    pendingB3dUrls.splice(0).forEach((url) => dispatchB3dUrl(url, forwardB3dRoute))
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)

    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return
  const iconPath = join(__dirname, '../../resources/icons/icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty() && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon)
  }

  registerIpc(() => mainWindow)
  installAppMenu(() => mainWindow)
  startAutoUpdates(() => mainWindow)
  createWindow(createSplash(APP_NAME))
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(createSplash(APP_NAME))
  })
})

app.on('window-all-closed', () => {
  stopMdnsScan()
  closeAllPrintStateWatches()
  closeAllPluginLogWatches()
  if (process.platform !== 'darwin') app.quit()
})
