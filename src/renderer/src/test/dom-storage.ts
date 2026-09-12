// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Point a jsdom test's storage globals at the jsdom window, on the runtimes that hide it.
//
// Node 26 owns `localStorage` / `sessionStorage` itself: they are OWN globals from process start,
// and localStorage's getter returns undefined unless node was started with --localstorage-file.
// vitest's jsdom environment copies a window key onto the global only where the runtime does not
// already own it, so on Node 26 it copies neither, and a renderer test that reads `localStorage`
// gets node's undefined and dies on `.getItem`. The jsdom window has the real Storage all along;
// this hands it to the global. A setup file, so the fix lands once for the whole suite.
//
// Node 20 (the CI runtime) declares no such globals, so there vitest's own copy already reads
// through to the window and this re-points the global at the very object that copy yields: same
// Storage, same jsdom teardown, nothing observable changes. Every `environment: 'node'` test file
// stands down outright, having no jsdom window to take a Storage from.
//
// The window has to come from vitest's own `jsdom` handle: the environment aliases `window`, `self`
// and `document.defaultView` to globalThis, so all three lead back to the global that is missing the
// storage rather than to the window that has it.

const STORAGE_KEYS = ['localStorage', 'sessionStorage'] as const

type StorageKey = (typeof STORAGE_KEYS)[number]

function jsdomWindow(): Window | undefined {
  return (globalThis as { jsdom?: { window: Window } }).jsdom?.window
}

// Read the global through its descriptor, never through the property: node's getter is the one that
// warns about the missing --localstorage-file, and nothing here needs to provoke it.
function alreadyAdopted(win: Window, key: StorageKey): boolean {
  return Object.getOwnPropertyDescriptor(globalThis, key)?.value === win[key]
}

// configurable, so jsdom teardown can still take the global back down with the window.
function adoptFromWindow(win: Window, key: StorageKey): void {
  if (alreadyAdopted(win, key)) return

  Object.defineProperty(globalThis, key, { value: win[key], writable: true, configurable: true })
}

function adoptWindowStorage(): void {
  const win = jsdomWindow()
  if (!win) return

  STORAGE_KEYS.forEach((key) => adoptFromWindow(win, key))
}

adoptWindowStorage()
