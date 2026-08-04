// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useAsyncResource } from '../../common/hooks/useAsyncResource'
import { useSettledValue } from '../../common/hooks/useSettledValue'
import type { ServiceReach } from './reach-note'

// Long enough that typing an address is not chased keystroke by keystroke, short enough that the
// answer is there while the person is still looking at the field.
const TYPING_PAUSE_MS = 500

// Whether the address in the field answers, asked again every time the address stops changing: a
// protocol picked, a port corrected, a name pasted. Waiting for the field to be left was too late,
// because choosing a protocol never leaves it.
export function useServiceReach(address: string, answersAt: (typed: string) => Promise<ServiceReach | null>) {
  const settled = useSettledValue(address, TYPING_PAUSE_MS)
  const { value, loading } = useAsyncResource(() => answersAt(settled), [settled])

  return {
    checking: loading && settled.trim() !== '' && settled === address,
    reach: value?.address === address ? value : null
  }
}
