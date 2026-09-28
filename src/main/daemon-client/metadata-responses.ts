// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PrinterRecord } from '../printers'
import { fetchCapabilities, fetchDaemonStatus, fetchSelfCheck } from './client'
import { DaemonHttpError } from './transport'

export type DaemonMetadataResponses = {
  status: Awaited<ReturnType<typeof fetchDaemonStatus>>
  caps: Awaited<ReturnType<typeof fetchCapabilities>>
  selfCheck: Awaited<ReturnType<typeof fetchSelfCheck>> | null
}

function failedMetadataResult(statusResult: PromiseSettledResult<unknown>, capsResult: PromiseSettledResult<unknown>): unknown {
  const failures = [statusResult, capsResult].filter((result): result is PromiseRejectedResult => result.status === 'rejected')

  return failures.find((result) => result.reason instanceof DaemonHttpError && result.reason.statusCode === 401)?.reason ?? failures[0]?.reason
}

export async function fetchMetadataResponses(record: PrinterRecord, timeoutMs: number): Promise<DaemonMetadataResponses | { failure: unknown }> {
  const [statusResult, capsResult, selfCheckResult] = await Promise.allSettled([
    fetchDaemonStatus(record, timeoutMs),
    fetchCapabilities(record, timeoutMs),
    fetchSelfCheck(record, timeoutMs),
  ])
  if (statusResult.status === 'rejected' || capsResult.status === 'rejected') {
    return { failure: failedMetadataResult(statusResult, capsResult) }
  }

  return {
    status: statusResult.value,
    caps: capsResult.value,
    selfCheck: selfCheckResult.status === 'fulfilled' ? selfCheckResult.value : null,
  }
}
