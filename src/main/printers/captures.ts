import { loadPrinter, updatePrinter } from './store'

const CAPTURE_CAP = 50

// Dedupe-append a captured string, newest last, dropping the oldest past the cap. A value already
// present moves to neither end (it is simply kept), so a re-emitted snapshot match never duplicates.
export function mergeCapture(existing: string[], value: string, cap: number): string[] {
  if (existing.includes(value)) return existing

  return [...existing, value].slice(-cap)
}

export function appendPluginCapture(printerId: string, pluginId: string, value: string): string[] {
  const merged = updatePrinter(printerId, (current) => {
    const captures = current.pluginCaptures ?? {}

    return { pluginCaptures: { ...captures, [pluginId]: mergeCapture(captures[pluginId] ?? [], value, CAPTURE_CAP) } }
  })

  return merged?.pluginCaptures?.[pluginId] ?? []
}

export function pluginCaptures(printerId: string, pluginId: string): string[] {
  return loadPrinter(printerId)?.pluginCaptures?.[pluginId] ?? []
}
