// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext } from 'react'
import type { B3dEntityRef } from '../../../data/b3d-ref'

// A b3d:// entity link in a description resolves INSIDE the app (open that plugin), never through the
// OS protocol layer (ADR-0023). When no handler is provided the link renders as inert text rather
// than a dead external link.
export const B3dRefContext = createContext<((ref: B3dEntityRef) => void) | null>(null)
