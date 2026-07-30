// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { InstallGateModals } from './index'
import { useInstallGate } from '../../hooks/installGate'
import { Button } from '../common/Button'

export default { title: 'Store / Install gate' }

// The gate as the app mounts it: pressing the button is an install asking to start, so the offer, the
// refresh and the what-moved list all come from the real gate rather than from props set by hand.
export function AnInstallAskingToStart() {
  const gate = useInstallGate()

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => gate.beforeInstall(() => undefined)}>Install a plugin</Button>
      <InstallGateModals gate={gate} />
    </>
  )
}
