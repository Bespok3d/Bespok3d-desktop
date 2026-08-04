// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Port allocation for plugins that compete for the same HTTP port resource: the web UIs.
// The primary UI holds PRIMARY_PORT (80); every other UI gets the next free port from
// SECONDARY_BASE (81) upward, skipping ports reserved for system services. Ports are
// auto-assigned but the user may override one in the plugin's Config; an override onto a
// port another UI holds moves that other UI, and only a reserved or out-of-range port is
// refused outright. Arbitration is entirely
// app-side, so the daemon only realizes the port it is handed.

export const PRIMARY_PORT = 80
export const SECONDARY_BASE = 81
export const RESERVED_PORTS = [22, 4269, 7125]

function isReserved(port: number): boolean {
  return RESERVED_PORTS.includes(port)
}

function lowestFreeFrom(candidate: number, blocked: Set<number>): number {
  return blocked.has(candidate) ? lowestFreeFrom(candidate + 1, blocked) : candidate
}

// The port a newly added UI should take: 80 while it is free (the first UI becomes
// primary), otherwise the lowest free secondary port.
export function assignPort(portsTakenByOtherUis: number[]): number {
  const blocked = new Set([...portsTakenByOtherUis, ...RESERVED_PORTS])
  if (!blocked.has(PRIMARY_PORT)) return PRIMARY_PORT

  return lowestFreeFrom(SECONDARY_BASE, blocked)
}

// Give `claimantPluginId` the port it asks for and reflow whichever UI currently holds that
// port onto the next free secondary port. Other UIs keep their ports. A port another UI holds
// is never a dead end for the user: the other UI moves.
export function takePort(
  portsByPluginId: Record<string, number>,
  claimantPluginId: string,
  claimedPort: number,
): Record<string, number> {
  const displacedId = Object.keys(portsByPluginId).find(
    (pluginId) => pluginId !== claimantPluginId && portsByPluginId[pluginId] === claimedPort,
  )
  const reassigned: Record<string, number> = { ...portsByPluginId, [claimantPluginId]: claimedPort }
  if (displacedId === undefined) return reassigned
  const portsHeldByOthers = Object.entries(reassigned)
    .filter(([pluginId]) => pluginId !== displacedId)
    .map(([, heldPort]) => heldPort)
  reassigned[displacedId] = assignPort(portsHeldByOthers)

  return reassigned
}

export interface PortProblem {
  key: string
  params: Record<string, number>
}

// Why a manual port override cannot be used at all, or null when it can. A port another UI
// holds is NOT one of these: that one is settled by moving the other UI, not by refusing.
export function portConflict(port: number): PortProblem | null {
  if (port < PRIMARY_PORT) return { key: 'store.port_too_low', params: { min: PRIMARY_PORT } }
  if (isReserved(port)) return { key: 'store.port_reserved', params: { port } }

  return null
}
