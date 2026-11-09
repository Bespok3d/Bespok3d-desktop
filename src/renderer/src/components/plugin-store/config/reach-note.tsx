// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'

export interface ServiceReach {
  address: string
  answered: boolean
  // The http code it answered with, when the answer came back as one. A plain socket check and an
  // address nothing answers at all both have none.
  httpCode?: number
  // The printer that should have tried the address could not be asked, so nothing is known about it.
  unasked?: boolean
}

// Where the address was tried from. A host and port is tried from this computer; a whole web address
// is tried from the printer, which is where the plugin will use it.
export type ReachTriedFrom = 'computer' | 'printer'

const REACH_WORDS: Record<ReachTriedFrom, { reachable: string; httpError: string; unreachable: string }> = {
  computer: {
    reachable: 'store.address_reachable',
    httpError: 'store.address_http_error',
    unreachable: 'store.address_unreachable',
  },
  printer: {
    reachable: 'store.address_reachable_printer',
    httpError: 'store.address_http_error_printer',
    unreachable: 'store.address_unreachable_printer',
  },
}

// The line under an address field: what is wrong with what was typed, or whether the address answered
// where it was tried. Not reaching it is said as a warning, never a block: the person is the one who
// knows the network. A service that answers with an error says which one, because a 404 and a 401
// are two different things to go and fix.
export function ReachNote({ checking, reach, shapeError, triedFrom }: {
  checking: boolean; reach: ServiceReach | null; shapeError: string | null; triedFrom: ReachTriedFrom
}) {
  const { t } = useI18n()
  const words = REACH_WORDS[triedFrom]
  if (shapeError) return <p className="config-error">{t(shapeError)}</p>
  if (checking) return <p className="config-reach">{t('store.address_checking')}</p>
  if (!reach) return null
  if (reach.unasked) return <p className="config-reach config-reach-warn">{t('store.address_printer_unasked')}</p>
  if (reach.answered) return <p className="config-reach config-reach-ok">{t(words.reachable)}</p>
  if (reach.httpCode) return <p className="config-reach config-reach-warn">{t(words.httpError, { code: reach.httpCode })}</p>

  return <p className="config-reach config-reach-warn">{t(words.unreachable)}</p>
}
