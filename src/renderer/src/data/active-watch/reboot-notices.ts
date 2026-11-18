// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The reboots the active watch carried out while this app listened, as notices. A reboot taken back
// loses its notice. A removed printer shows nothing until it is watched again.
import { useSyncExternalStore } from 'react'

var notices: RebootNotice[] = []
const removedPrinters = new Set<string>()
const noticesListeners = new Set<() => void>()

export interface RebootNotice {
  printerId: string
  printerName: string
  noticeId: string
  rebootedAt: number
}

function showNotices(nextNotices: RebootNotice[]): void {
  notices = nextNotices
  noticesListeners.forEach((listener) => listener())
}

function isSameNotice(shown: RebootNotice, printerId: string, noticeId: string): boolean {
  return shown.printerId === printerId && shown.noticeId === noticeId
}

function isShown(printerId: string, noticeId: string): boolean {
  return notices.some((shown) => isSameNotice(shown, printerId, noticeId))
}

export function rebootNotices(): RebootNotice[] {
  return notices
}

export function subscribeToRebootNotices(listener: () => void): () => void {
  noticesListeners.add(listener)

  return () => { noticesListeners.delete(listener) }
}

export function addRebootNotice(notice: RebootNotice): void {
  if (removedPrinters.has(notice.printerId) || isShown(notice.printerId, notice.noticeId)) return
  showNotices([...notices, notice])
}

export function removeRebootNotice(printerId: string, noticeId: string): void {
  if (!isShown(printerId, noticeId)) return
  showNotices(notices.filter((shown) => !isSameNotice(shown, printerId, noticeId)))
}

// The watch of a removed printer may still deliver a frame before it stops.
export function removeRebootNoticesOf(printerId: string): void {
  removedPrinters.add(printerId)
  if (!notices.some((notice) => notice.printerId === printerId)) return
  showNotices(notices.filter((notice) => notice.printerId !== printerId))
}

export function watchRebootNoticesOf(printerId: string): void {
  removedPrinters.delete(printerId)
}

export function useRebootNotices(): RebootNotice[] {
  return useSyncExternalStore(subscribeToRebootNotices, rebootNotices)
}
