// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useSyncExternalStore } from 'react'
import { anyModalOpen, subscribeToOpenModals } from './modal-stack'

// Whether any modal is on screen, wherever in the tree it was mounted, for what must not open over one.
export function useAnyModalOpen(): boolean {
  return useSyncExternalStore(subscribeToOpenModals, anyModalOpen)
}
