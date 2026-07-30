// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { MovedVersionsDialog } from './MovedVersionsDialog'

export default { title: 'Store / Install gate' }

function noop() {}

export function OnePluginMoved() {
  return (
    <MovedVersionsDialog
      moved={[{ pluginName: 'spoolman', listedVersion: '0.1.28', freshVersion: '0.1.29' }]}
      onConfirm={noop}
      onCancel={noop}
    />
  )
}

export function SeveralPluginsMoved() {
  return (
    <MovedVersionsDialog
      moved={[
        { pluginName: 'spoolman', listedVersion: '0.1.28', freshVersion: '0.1.29' },
        { pluginName: 'camera', listedVersion: '0.1.5', freshVersion: '0.2.0' },
        { pluginName: 'remote-screen', listedVersion: '0.1.19', freshVersion: '0.1.20' },
      ]}
      onConfirm={noop}
      onCancel={noop}
    />
  )
}
