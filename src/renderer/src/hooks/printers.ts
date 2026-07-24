import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { Printer } from '../data/types'
import type { DiscoveredPrinterRecord } from '../env'
import { toPrinter, reconcileDiscoveredAddress, pingAndUpdate, resetPrinterProbe, patchAndSave } from '../data/printers'
import { mergeDiscovered } from '../data/printerDiscovery'

interface SyncCtx {
  selectedId: string | null
  setSelectedId: Dispatch<SetStateAction<string | null>>
  setPrinters: Dispatch<SetStateAction<Printer[]>>
}

function removePrinter(ctx: SyncCtx, id: string): void {
  window.b3d.printers.remove(id)
  resetPrinterProbe(id)
  ctx.setPrinters((prev) => {
    const next = prev.filter((printer) => printer.id !== id)
    if (ctx.selectedId === id) ctx.setSelectedId(next[0]?.id ?? null)

    return next
  })
}

export function usePrinterSync() {
  const [printers, setPrinters] = useState<Printer[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const printerListRef = useRef<Printer[]>([])

  const ctx: SyncCtx = { selectedId, setSelectedId, setPrinters }

  function syncListRef() { printerListRef.current = printers }
  function startStatusPolling() {
    const pollInterval = setInterval(() => {
      printerListRef.current.forEach((printer) => pingAndUpdate(printer, setPrinters))
    }, 15000)

    return () => clearInterval(pollInterval)
  }
  function loadSavedPrinters() {
    window.b3d.printers.load().then((records) => {
      const loaded = records.map((rec) => toPrinter({ ...rec, status: 'checking' }))
      setPrinters(loaded)
      setSelectedId(loaded[0]?.id ?? null)
      loaded.forEach((printer) => pingAndUpdate(printer, setPrinters))
    })
  }

  function handleRemovePrinter(id: string) { removePrinter(ctx, id) }
  function handleUpdatePrinterIcon(id: string, color?: string, image?: string, size?: number) {
    patchAndSave(setPrinters, id, { iconColor: color, iconImage: image, iconSize: size })
  }
  function handleSetCustomSshCredentials(id: string, value: boolean) {
    patchAndSave(setPrinters, id, { customSshCredentials: value })
  }

  useEffect(syncListRef, [printers])
  useEffect(startStatusPolling, [])
  useEffect(loadSavedPrinters, [])

  return { printers, setPrinters, selectedId, setSelectedId, handleRemovePrinter, handleUpdatePrinterIcon, handleSetCustomSshCredentials }
}

export function useMdnsDiscovery(setPrinters: Dispatch<SetStateAction<Printer[]>>) {
  const [discovered, setDiscovered] = useState<DiscoveredPrinterRecord[]>([])

  function subscribeToMdns() {
    window.b3d.mdns.start()
    const unsub = window.b3d.mdns.onFound((found) => {
      if (!found.ip) return
      setDiscovered((prev) => {
        const existing = prev.find((device) => device.ip === found.ip)
        if (!existing) return [...prev, found]
        const merged = mergeDiscovered(existing, found)
        if (merged === existing) return prev

        return prev.map((device) => (device.ip === found.ip ? merged : device))
      })
      setPrinters((prev) =>
        prev.map((printer) => {
          const reconciled = reconcileDiscoveredAddress(printer, found)
          if (reconciled.ip !== printer.ip) window.b3d.printers.patch(printer.id, { ip: reconciled.ip, status: reconciled.status })

          return reconciled
        })
      )
    })

    return () => { window.b3d.mdns.stop(); unsub() }
  }
  useEffect(subscribeToMdns, [])

  return { discovered, setDiscovered }
}
