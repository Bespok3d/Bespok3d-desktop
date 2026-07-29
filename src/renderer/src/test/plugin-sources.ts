// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The sibling plugins/ tree, as the tests that assert on real manifests see it.
//
// The app is developed and packaged inside the Bespok3d workspace, where plugins/ sits beside this
// repo and every manifest is there. Someone who cloned only this repo has no such tree, so a test
// that asserts on real plugin data has nothing to assert on. Those tests stand down instead of
// failing, the same way the bundle rails in scripts/test/ do, and a bare checkout still reaches a
// green gate. Inside the workspace the tree is there and every one of them runs.
//
// Payload manifests under files/ are excluded (remote-screen ships a PWA manifest.json of its own),
// mirroring the discovery in scripts/app-bundle.mjs so what the tests see matches a real build.

const RAW_MANIFESTS = import.meta.glob(
  [
    '../../../../../plugins/**/manifest.json',
    '!**/files/**',
    '!**/doc/**',
    '!**/dist/**',
    '!**/node_modules/**',
    '!**/*-bleeding-edge/**',
  ],
  { eager: true, import: 'default' },
) as Record<string, Record<string, unknown>>

export const PLUGIN_MANIFESTS = Object.values(RAW_MANIFESTS)

export const NO_PLUGIN_SOURCES = PLUGIN_MANIFESTS.length === 0
