// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { BatchConfigModal } from './BatchConfigModal'
import { makePlugin } from '../../../test/fixtures'

export default { title: 'Store / Select / Required install values' }

function dismissPreview() {}

const selectedPlugins = [
  makePlugin({ id: 'spoolman', title: 'Spoolman', config: [
    { key: 'SERVER', label: 'Spoolman server', type: 'url', scope: 'global', required: true },
    { key: 'LOCATION', label: 'Location', type: 'text', scope: 'global' },
  ] }),
  makePlugin({ id: 'other', title: 'Another plugin', config: [
    { key: 'SERVER', label: 'Other server', type: 'text', scope: 'global', required: true },
  ] }),
]

export function TwoRequiredPlugins() {
  return <BatchConfigModal plugins={selectedPlugins} savedVars={{}} busy={false} onCancel={dismissPreview} onConfirm={dismissPreview} />
}
