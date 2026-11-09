// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext } from 'react'

// The managed printer that tries a web address typed into a plugin's config, because that printer is
// where the plugin will use it. Undefined when no managed printer is selected: there is then no one
// to ask, and the field says so.
export const AddressCheckPrinterContext = createContext<string | undefined>(undefined)

export function useAddressCheckPrinter(): string | undefined {
  return useContext(AddressCheckPrinterContext)
}
