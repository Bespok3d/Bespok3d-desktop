// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { RefreshOfferDialog } from './RefreshOfferDialog'

export default { title: 'Store / Install gate' }

const THREE_HOURS_MS = 3 * 60 * 60 * 1000

function noop() {}

export function ListingThreeHoursOld() {
  return (
    <RefreshOfferDialog
      refreshedAt={Date.now() - THREE_HOURS_MS}
      refreshing={false}
      onRefresh={noop}
      onProceed={noop}
      onCancel={noop}
    />
  )
}

export function ListingNeverRefreshed() {
  return (
    <RefreshOfferDialog refreshedAt={null} refreshing={false} onRefresh={noop} onProceed={noop} onCancel={noop} />
  )
}

export function AskingTheRepos() {
  return (
    <RefreshOfferDialog refreshedAt={Date.now() - THREE_HOURS_MS} refreshing onRefresh={noop} onProceed={noop} onCancel={noop} />
  )
}
