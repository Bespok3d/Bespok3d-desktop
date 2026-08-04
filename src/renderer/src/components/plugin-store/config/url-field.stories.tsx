// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { UrlField } from './url-field'
import type { PluginConfigField } from '../../../data/types'
import '../plugin-store.css'

export default { title: 'Store / Config / UrlField' }

const SPOOLMAN_SERVER: PluginConfigField = {
  key: 'SPOOLMAN_SERVER',
  label: 'Server',
  type: 'url',
  scope: 'global',
  placeholder: 'https://spoolman.example.org',
}

// The field owns no value of its own, exactly as it does inside a real config form.
function Field({ start }: { start: string }) {
  const [value, setValue] = useState(start)

  return (
    <div className="config-field">
      <UrlField field={SPOOLMAN_SERVER} value={value} onChange={setValue} />
    </div>
  )
}

// A server behind a name and a certificate, written whole and kept exactly as it is.
export function BehindANameAndCertificate() {
  return <Field start="https://spoolman.example.org/" />
}

// An address on the local network with its own port: still stored with the protocol in front.
export function OnTheLocalNetwork() {
  return <Field start="http://192.0.2.50:8000" />
}

// Typed without a protocol: the picker is empty and the line says which choice is missing.
export function ProtocolNotChosen() {
  return <Field start="192.0.2.50:8000" />
}

// Not readable as an address: the message shows and install stays blocked until it is fixed.
export function Unusable() {
  return <Field start="my spoolman server" />
}
