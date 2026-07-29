// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Port allocation for plugins that compete for the same HTTP port resource: the web UIs.
// The primary UI holds PRIMARY_PORT (80); every other UI gets the next free port from
// SECONDARY_BASE (81) upward, skipping ports reserved for system services. Ports are
// auto-assigned but the user may override one in the plugin's Config; an override that
// collides with another UI or a reserved port is rejected. Arbitration is entirely
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

// Move `primaryPluginId` to port 80 and reflow whichever UI currently holds 80 onto the
// next free secondary port. Other UIs keep their ports.
export function makePrimary(
  portsByPluginId: Record<string, number>,
  primaryPluginId: string,
): Record<string, number> {
  const displacedId = Object.keys(portsByPluginId).find(
    (pluginId) => pluginId !== primaryPluginId && portsByPluginId[pluginId] === PRIMARY_PORT,
  )
  const reassigned: Record<string, number> = { ...portsByPluginId, [primaryPluginId]: PRIMARY_PORT }
  if (displacedId === undefined) return reassigned
  const portsHeldByOthers = Object.entries(reassigned)
    .filter(([pluginId]) => pluginId !== displacedId)
    .map(([, port]) => port)
  reassigned[displacedId] = assignPort(portsHeldByOthers)

  return reassigned
}

// Why a manual port override is rejected, or null when it is acceptable.
export function portConflict(port: number, portsTakenByOtherUis: number[]): string | null {
  if (port < PRIMARY_PORT) return `Port must be ${PRIMARY_PORT} or higher.`
  if (isReserved(port)) return `Port ${port} is reserved by the system.`
  if (portsTakenByOtherUis.includes(port)) return `Port ${port} is already used by another UI.`

  return null
}
