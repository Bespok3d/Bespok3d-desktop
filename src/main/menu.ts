// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

// A proper application menu so the app reads "Bespok3d" (packaged; macOS keeps the bundle name in
// dev) and File/Edit/View/Window keep their standard roles, plus a "Check for Updates" entry that
// opens Settings > Update in the renderer.

type WindowGetter = () => BrowserWindow

function openUpdateSettings(getMainWindow: WindowGetter): void {
  getMainWindow().webContents.send('app-update:open-settings')
}

function checkForUpdatesItem(getMainWindow: WindowGetter): MenuItemConstructorOptions {
  return { label: 'Check for Updates…', click: () => openUpdateSettings(getMainWindow) }
}

// The native "About" panel is replaced by our own Settings > About pane, so the menu About item (the
// macOS app menu, the Help menu elsewhere) opens that instead.
function openAboutSettings(getMainWindow: WindowGetter): void {
  getMainWindow().webContents.send('app:open-about')
}

function aboutItem(getMainWindow: WindowGetter): MenuItemConstructorOptions {
  return { label: `About ${app.getName()}`, click: () => openAboutSettings(getMainWindow) }
}

function macAppMenu(getMainWindow: WindowGetter): MenuItemConstructorOptions {
  return {
    label: app.getName(),
    submenu: [
      aboutItem(getMainWindow),
      { type: 'separator' },
      checkForUpdatesItem(getMainWindow),
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }
}

function buildAppMenu(getMainWindow: WindowGetter): Menu {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [macAppMenu(getMainWindow)] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    { role: 'help', submenu: isMac ? [] : [checkForUpdatesItem(getMainWindow), aboutItem(getMainWindow)] },
  ]

  return Menu.buildFromTemplate(template)
}

export function installAppMenu(getMainWindow: WindowGetter): void {
  Menu.setApplicationMenu(buildAppMenu(getMainWindow))
}
