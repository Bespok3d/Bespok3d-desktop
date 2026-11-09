// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ReachNote } from './reach-note'
import '../plugin-store.css'

export default { title: 'Store / Config / ReachNote' }

const ADDRESS = 'https://spoolman.example.org/'

// While the address is being asked.
export function Checking() {
  return <ReachNote checking={true} reach={null} shapeError={null} triedFrom="computer" />
}

// Something answered this computer: a host and port is good from here.
export function Answered() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: true }} shapeError={null} triedFrom="computer" />
}

// Nothing answered this computer: a warning, never a block.
export function NothingAnswered() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: false }} shapeError={null} triedFrom="computer" />
}

// Something is there but does not serve this address: the code it answered with is the thing to
// go and fix, so it is on screen.
export function AnsweredWithAnError() {
  return (
    <ReachNote
      checking={false} reach={{ address: ADDRESS, answered: false, httpCode: 404 }} shapeError={null} triedFrom="computer"
    />
  )
}

// The printer reached the web address, which is where the plugin will use it.
export function PrinterReached() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: true }} shapeError={null} triedFrom="printer" />
}

// Nothing answered the printer, so the plugin will not reach the address either.
export function NothingAnsweredThePrinter() {
  return <ReachNote checking={false} reach={{ address: ADDRESS, answered: false }} shapeError={null} triedFrom="printer" />
}

// The printer reached something that answered with an error.
export function PrinterGotAnError() {
  return (
    <ReachNote
      checking={false} reach={{ address: ADDRESS, answered: false, httpCode: 401 }} shapeError={null} triedFrom="printer"
    />
  )
}

// No managed printer to ask, or one that gave no answer of its own: nothing is known about the address.
export function PrinterNotAsked() {
  return (
    <ReachNote
      checking={false} reach={{ address: ADDRESS, answered: false, unasked: true }} shapeError={null} triedFrom="printer"
    />
  )
}

// What was typed cannot be used, which outranks anything the network has to say about it.
export function Unusable() {
  return <ReachNote checking={false} reach={null} shapeError="store.address_unusable" triedFrom="printer" />
}
