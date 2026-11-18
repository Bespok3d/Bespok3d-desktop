// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Public surface of the active-watch data module: support (which daemons have the watch), the live
// feed hook, and the store of reboot notices the notification center shows.
export { daemonTooOldForActiveWatch, KNOWN_REBOOT_TOKENS } from './support'
export { useActiveWatch } from './useActiveWatch'
export { removeRebootNoticesOf, useRebootNotices } from './reboot-notices'
export type { RebootNotice } from './reboot-notices'
