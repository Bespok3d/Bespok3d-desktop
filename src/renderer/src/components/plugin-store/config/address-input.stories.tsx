// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { AddressInput } from './address-input'
import '../plugin-store.css'

export default { title: 'Store / Config / AddressInput' }

function noop() {}

// An address already typed in, shown exactly as it was given.
export function Typed() {
  return <AddressInput value="https://spoolman.example.org/" onChange={noop} onLeave={noop} />
}

// Empty, with the example the plugin suggests showing through.
export function Empty() {
  return <AddressInput placeholder="https://spoolman.example.org" value="" onChange={noop} onLeave={noop} />
}
