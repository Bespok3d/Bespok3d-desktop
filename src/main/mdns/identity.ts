// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// What a device calls itself in its mDNS TXT record, read the SAME way by both scanners. The raw
// scanner runs everywhere and the dns-sd scanner only on macOS, so a key known to one and not the
// other is a printer that auto-selects its adapter on a Mac and reads as "Network device" on Windows
// and Linux. The Snapmaker U1 is exactly that case: it announces machine_type and nothing else.

// Printer-specific first, then the generic keys a print server or an IPP device uses. Keys are
// lower-cased before lookup, so a record spelling one usb_MDL still matches.
const MODEL_KEYS = ['machine_type', 'model', 'product', 'usb_mdl']
const VENDOR_KEYS = ['vendor', 'manufacturer', 'mfg', 'usb_mfg']

export const UNKNOWN_MODEL = 'Network device'
export const UNKNOWN_VENDOR = 'Unknown'

function firstValue(txt: Record<string, string>, keys: string[]): string | undefined {
  const key = keys.find((candidate) => (txt[candidate] ?? '').trim().length > 0)

  return key ? txt[key].trim() : undefined
}

export function modelFromTxt(txt: Record<string, string>): string {
  return firstValue(txt, MODEL_KEYS) ?? UNKNOWN_MODEL
}

export function vendorFromTxt(txt: Record<string, string>): string {
  return firstValue(txt, VENDOR_KEYS) ?? UNKNOWN_VENDOR
}
