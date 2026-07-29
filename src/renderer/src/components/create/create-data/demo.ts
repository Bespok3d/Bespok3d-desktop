// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Demo identity, signing key, and a canned patch conflict for the Publish + snap-to-place previews
// (no real account is read; the patch engine runs locally, no printer needed).

export const DEMO_GITHUB_ACCOUNT = { login: 'you', publishRepo: 'you/bespok3d-plugins' }
export const DEMO_SIGNING_KEY = { label: 'Your publishing key', type: 'ed25519', fingerprintShort: '9F2A 4C7E', publishedTo: false }

// A canned conflict so the snap-to-place tool opens with real content. Adds one line to a small
// example Klipper source file.
export const DEMO_PATCH_CONFLICT = {
  patchId: 'demo-color-hook',
  targetId: 'toolhead.py',
  targetName: 'toolhead.py',
  targetContent: `class ToolHead:
    def __init__(self, config):
        self.printer = config.get_printer()
        self.reactor = self.printer.get_reactor()
        self.all_mcus = self.printer.lookup_objects('mcu')
        self.mcu = self.all_mcus[0]
        self._notify_data_update_cb = []
        self.filament_feed_objects = None
        self.can_pause = True
        self.printer.register_event_handler("klippy:ready", self._handle_ready)
`,
  patchContent: `@@ -7,3 +7,4 @@ class ToolHead:
         self._notify_data_update_cb = []
+        self._card_protocol_parsers = {}
         self.filament_feed_objects = None
         self.can_pause = True
`,
}
