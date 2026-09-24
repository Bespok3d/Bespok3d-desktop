// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
const electron = require('electron')

function suppressActivation() {}

function createHiddenWindow(WindowConstructor, constructorArguments) {
  const options = constructorArguments[0] || {}

  return Reflect.construct(WindowConstructor, [{
    ...options,
    show: false,
    focusable: false,
    paintWhenInitiallyHidden: true,
    webPreferences: { ...options.webPreferences, backgroundThrottling: false },
  }])
}

// Installed while the debugger pauses at the app entry point, before any window can flash.
if (process.platform === 'darwin') electron.app.setActivationPolicy('prohibited')
electron.app.focus = suppressActivation
;['show', 'showInactive', 'focus', 'restore', 'moveTop'].forEach(function suppressWindowMethod(method) {
  electron.BrowserWindow.prototype[method] = suppressActivation
})
// Mutated in place and never replaced with a copy: Playwright holds the exports object that
// require('electron') returned before this hook installed, so a replacement copy would leave that
// reference constructing plain windows that show on creation.
electron.BrowserWindow = new Proxy(electron.BrowserWindow, { construct: createHiddenWindow })
require.cache[require.resolve('electron')].exports = electron
// Every window, whatever class built it (Playwright's own electron reference predates this hook and
// constructs through an unwrapped class whose native show:true cannot be intercepted), gets its
// activation methods turned into no-ops per instance.
electron.app.on('browser-window-created', function suppressWindowInstance(_event, window) {
  window.show = suppressActivation
  window.showInactive = suppressActivation
  window.focus = suppressActivation
  window.restore = suppressActivation
  window.moveTop = suppressActivation
})
