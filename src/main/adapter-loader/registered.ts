// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The adapters this build carries, imported for their registerAdapter() side effect and nothing else.
// One list, in one place, loaded once from the main entry point: before this file the U1 was on the
// picker only because an unrelated ops module happened to import a helper out of it, so the picker
// offered adapters no build had ever registered and enrolling one threw "Unknown adapter".
//
// An adapter joins the build by joining this list. It exports nothing on purpose: importing it for a
// value would make somebody's module load order decide which adapters exist.
import '@adapters/snapmaker-u1/client/snapmaker-u1'
import '@adapters/klipper-linux/client/klipper-linux'

export {}
