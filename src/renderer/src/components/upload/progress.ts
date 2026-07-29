// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState, useEffect } from 'react'

export interface UploadProgress {
  sent: number
  total: number
  bytesPerSecond: number
}

// Average upload speed since the first byte of this transfer; 0 until time has elapsed.
export function uploadSpeed(sent: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0

  return (sent / elapsedMs) * 1000
}

// A human upload rate, or '' below the first measurable interval (so the bar shows just the percent).
export function formatUploadRate(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return ''
  const megabytesPerSecond = bytesPerSecond / (1024 * 1024)
  if (megabytesPerSecond >= 1) return `${megabytesPerSecond.toFixed(1)} MB/s`

  return `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`
}

export function uploadPercent(progress: UploadProgress): number {
  if (progress.total <= 0) return 0

  return Math.min(100, Math.round((progress.sent / progress.total) * 100))
}

// Subscribes to the client-side upload feed for one printer, exposing the live transfer or null when no
// upload is in flight (completion clears it so the phase steps take over). Average speed is computed
// from the first event of each transfer.
function watchUpload(printerId: string | undefined, setProgress: (next: UploadProgress | null) => void): () => void {
  var startedAt = 0
  if (!printerId) return () => {}

  return window.b3d.store.onUploadProgress((event) => {
    if (event.printerId !== printerId) return
    if (event.sent >= event.total) { startedAt = 0; setProgress(null);

 return }
    if (startedAt === 0) startedAt = Date.now()
    setProgress({ sent: event.sent, total: event.total, bytesPerSecond: uploadSpeed(event.sent, Date.now() - startedAt) })
  })
}

export function useUploadProgress(printerId: string | undefined): UploadProgress | null {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  useEffect(() => watchUpload(printerId, setProgress), [printerId])

  return progress
}
