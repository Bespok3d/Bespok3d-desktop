// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { X509Certificate } from 'crypto'
import type { PrinterRecord } from '../printers'
import { DaemonHttpError } from './transport'
import { fetchDaemonLicense } from './license-client'

export type DaemonAccessState = 'authorized' | 'present-awaiting-access' | 'credentials-rejected' | 'certificate-missing' | 'identity-changed' | 'daemon-absent' | 'offline' | 'unrecognized'

function savedCertificateFingerprint(certificate: string | undefined): string | null {
  if (!certificate) return null
  try {
    return new X509Certificate(certificate).fingerprint256
  } catch {
    return null
  }
}

function rejectedAccessState(record: PrinterRecord, failure: unknown, licenseFingerprint: string): DaemonAccessState {
  const savedFingerprint = savedCertificateFingerprint(record.daemonCert)
  if (savedFingerprint && savedFingerprint !== licenseFingerprint) return 'identity-changed'
  if (record.daemonToken && !savedFingerprint) return 'certificate-missing'
  if (failure instanceof DaemonHttpError && failure.statusCode === 401) return 'credentials-rejected'

  return 'unrecognized'
}

export async function unverifiedDaemonState(record: PrinterRecord, failure?: unknown): Promise<DaemonAccessState> {
  try {
    const license = await fetchDaemonLicense(record.ip)
    if (!record.daemonToken && !record.daemonCert && !record.accessIdentity && !record.enrollmentLog) return 'present-awaiting-access'

    return rejectedAccessState(record, failure, license.certificateFingerprint)
  } catch {
    return 'unrecognized'
  }
}
