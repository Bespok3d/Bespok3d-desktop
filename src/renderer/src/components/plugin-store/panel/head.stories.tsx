// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PanelHead } from './head'
import { makePlugin } from '../../../test/fixtures'
import '../plugin-store.css'

export default { title: 'Store / Plugin panel / Trust evidence' }

const PLUGIN = makePlugin({ id: 'camera', title: 'Camera', trust: 'project' })

export function PackageSignatureHistory() {
  return <div className="panel-stat-row">
    <PanelHead plugin={PLUGIN} installed hasUpdate={false} packageTrust="project" />
    <PanelHead plugin={PLUGIN} installed hasUpdate={false} packageTrust="unknown" />
    <PanelHead plugin={PLUGIN} installed hasUpdate={false} />
  </div>
}
