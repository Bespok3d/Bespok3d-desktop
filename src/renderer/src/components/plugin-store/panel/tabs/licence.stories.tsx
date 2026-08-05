// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { PanelLicence } from './licence'
import { makePlugin } from '../../../../test/fixtures'
import '../../plugin-store.css'

export default { title: 'Store / Licence tab' }

const LICENCE_LINK = 'https://github.com/Bespok3d/u1-hw-camera/blob/main/plugin/doc/LICENSE'

const CREDITED = makePlugin({
  id: 'camera-hw-accel', name: 'camera-hw-accel', title: 'Camera HW Accel',
  licenseUrl: LICENCE_LINK,
  attributions: '# Attributions - camera-hw-accel\n\n**Plugin author:** Bespok3d\n\n| Upstream project | Author | Licence |\n| --- | --- | --- |\n| Rockchip MPP | Rockchip | Apache-2.0 |\n| go2rtc | AlexxIT | MIT |\n',
})

const LICENCE_ONLY = makePlugin({ id: 'cpu-temp', name: 'cpu-temp', title: 'CPU Temperature', licenseUrl: LICENCE_LINK })

export function CreditsAndLicence() {
  return <PanelLicence plugin={CREDITED} />
}

export function LicenceOnly() {
  return <PanelLicence plugin={LICENCE_ONLY} />
}
