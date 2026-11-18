// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Listens to the active watch of every managed printer whose daemon has one. A fault it reports goes
// on that printer's reboot list; a reboot it carried out becomes a notice, and a reboot it took back
// loses its notice and goes on the reboot list.
import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'

import type { Printer } from '../types'
import type { SetPrinters } from '../printers/list'
import { daemonHasActiveWatch } from './support'
import { withRebootToken, withoutRebootToken } from './reboot-token'
import { addRebootNotice, removeRebootNotice, watchRebootNoticesOf } from './reboot-notices'

type LatestPrinters = MutableRefObject<Printer[]>

function watchedPrinterIds(printers: Printer[]): string[] {
  return printers
    .filter((printer) => printer.status === 'managed' && daemonHasActiveWatch(printer.daemonVersion))
    .map((printer) => printer.id)
}

function printerName(latestPrinters: LatestPrinters, printerId: string): string {
  const printer = latestPrinters.current.find((saved) => saved.id === printerId)

  return printer ? printer.nick || printer.model : printerId
}

function showRebootNotice(latestPrinters: LatestPrinters, printerId: string, noticeId: string): void {
  addRebootNotice({ printerId, printerName: printerName(latestPrinters, printerId), noticeId, rebootedAt: Date.now() })
}

// A fault the printer is already restarting to clear gets the notice only: asking the user to power
// cycle it as well would show two answers to one problem. A notify frame naming a notice takes that
// reboot back, so its notice goes before the power-cycle request comes, for the same reason.
function applyFrame(event: ActiveWatchEvent, setPrinters: SetPrinters, latestPrinters: LatestPrinters): void {
  if (event.remedy === 'reboot' && event.noticeId) {
    setPrinters(withoutRebootToken(event.printerId, event.token))
    showRebootNotice(latestPrinters, event.printerId, event.noticeId)

    return
  }
  if (event.noticeId) removeRebootNotice(event.printerId, event.noticeId)
  setPrinters(withRebootToken(event.printerId, event.token))
}

export function useActiveWatch(printers: Printer[], setPrinters: SetPrinters): void {
  const latestPrinters = useRef(printers)
  latestPrinters.current = printers
  const watchedKey = watchedPrinterIds(printers).join('|')
  function startWatching(): () => void {
    const printerIds = watchedPrinterIds(latestPrinters.current)
    const live = { current: true }
    const stopFrames = window.b3d.printers.onActiveWatch((event) => {
      if (live.current && printerIds.includes(event.printerId)) applyFrame(event, setPrinters, latestPrinters)
    })
    printerIds.forEach((printerId) => {
      watchRebootNoticesOf(printerId)
      window.b3d.printers.watchActiveWatch(printerId)
    })

    // The next watch of the same printers runs right after this cleanup. Letting go of the old ones
    // only after it keeps their feeds open: a closed feed would lose the frames sent while it reopens.
    return () => {
      live.current = false
      stopFrames()
      queueMicrotask(() => printerIds.forEach((printerId) => window.b3d.printers.unwatchActiveWatch(printerId)))
    }
  }
  useEffect(startWatching, [watchedKey])
}
