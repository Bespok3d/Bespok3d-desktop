// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { AddressField } from './address-field'
import type { PluginConfigField } from '../../../data/types'
import '../plugin-store.css'

export default { title: 'Store / Config / AddressField' }

const SPOOLMAN_SERVER: PluginConfigField = {
  key: 'SPOOLMAN_SERVER',
  label: 'Server',
  type: 'address',
  scope: 'global',
  placeholder: '192.168.1.50:8000',
}

// The field owns no value of its own, exactly as it does inside a real config form.
function Field({ start }: { start: string }) {
  const [value, setValue] = useState(start)

  return (
    <div className="config-field">
      <AddressField field={SPOOLMAN_SERVER} value={value} onChange={setValue} />
    </div>
  )
}

// Leaving the field cleans a pasted browser link down to the host and port the plugin asks for.
export function PastedBrowserUrl() {
  return <Field start="http://192.168.1.50:8000/spoolman/" />
}

// What is already in the shape a plugin documents stays exactly as typed.
export function AlreadyClean() {
  return <Field start="192.168.1.50:8000" />
}

// Not readable as an address: the message shows and install stays blocked until it is fixed.
export function Unusable() {
  return <Field start="my spoolman server" />
}
