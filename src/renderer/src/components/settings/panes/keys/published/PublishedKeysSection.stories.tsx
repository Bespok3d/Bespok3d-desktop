// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PublishedKeysSection } from '../PublishedKeysSection'
import '../../../settings.css'

export default { title: 'Settings / Keys / Published account' }

export function MissingPrivateKey() {
  return <div className="settings-content-body"><PublishedKeysSection onImported={() => {}} /></div>
}
