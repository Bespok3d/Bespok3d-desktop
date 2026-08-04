// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useI18n } from '../../../i18n/context'

export interface ServiceReach {
  address: string
  answered: boolean
  // The http code it answered with, when the answer came back as one. A plain socket check and an
  // address nothing answers at all both have none.
  httpCode?: number
}

// The line under an address field: what is wrong with what was typed, or whether this computer could
// reach it. Not reaching it is said as a warning, never a block: the printer and this computer are
// not always on the same network, and the person is the one who knows which. A service that answers
// with an error says which one, because a 404 and a 401 are two different things to go and fix.
export function ReachNote({ checking, reach, shapeError }: {
  checking: boolean; reach: ServiceReach | null; shapeError: string | null
}) {
  const { t } = useI18n()
  if (shapeError) return <p className="config-error">{t(shapeError)}</p>
  if (checking) return <p className="config-reach">{t('store.address_checking')}</p>
  if (!reach) return null
  if (reach.answered) return <p className="config-reach config-reach-ok">{t('store.address_reachable')}</p>
  if (reach.httpCode) return <p className="config-reach config-reach-warn">{t('store.address_http_error', { code: reach.httpCode })}</p>

  return <p className="config-reach config-reach-warn">{t('store.address_unreachable')}</p>
}
