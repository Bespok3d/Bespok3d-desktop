// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ReachNote } from './reach-note'
import '../plugin-store.css'

export default { title: 'Store / Config / ReachNote' }

const ADDRESS = 'https://spoolman.example.org/'

// While this computer is asking the address.
export function Checking() {
  return <ReachNote checking={true} reach={null} shapeError={null} />
}

// Something answered: the address is good from here.
export function Answered() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: true }} shapeError={null} />
}

// Nothing answered: a warning, never a block, because the printer may reach what this computer cannot.
export function NothingAnswered() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: false }} shapeError={null} />
}

// Something is there but does not serve this address: the code it answered with is the thing to
// go and fix, so it is on screen.
export function AnsweredWithAnError() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: false, httpCode: 404 }} shapeError={null} />
}

// What was typed cannot be used, which outranks anything the network has to say about it.
export function Unusable() {
  return <ReachNote checking={false} reach={null} shapeError="store.address_unusable" />
}
