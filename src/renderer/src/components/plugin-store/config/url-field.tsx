// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../../../data/types'
import type { ServiceScheme } from '../../../data/service-url'
import { SERVICE_SCHEMES, serviceUrlError, typedScheme, withScheme } from '../../../data/service-url'
import { useI18n } from '../../../i18n/context'
import { AddressInput } from './address-input'
import type { ServiceReach } from './reach-note'
import { ReachNote } from './reach-note'
import { useServiceReach } from './use-service-reach'
import { useAddressCheckPrinter } from './address-check-printer'

// Answering at all is what the plugin needs, so a redirect counts; an error code means something is
// there but not serving this address, which is worth saying and never worth blocking on.
const FIRST_ERROR_CODE = 400

// The plugin uses the address from the printer, so the printer tries it: an address this computer
// reaches can still be out of the printer's reach, and the other way around.
async function answersAt(address: string, printerId?: string): Promise<ServiceReach | null> {
  if (serviceUrlError(address)) return null
  if (!printerId) return { address, answered: false, unasked: true }
  const printerReach = await window.b3d.net.askPrinterToReach(printerId, address.trim())
  if (!printerReach.asked) return { address, answered: false, unasked: true }
  if (printerReach.httpCode === null) return { address, answered: false }

  return { address, answered: printerReach.httpCode < FIRST_ERROR_CODE, httpCode: printerReach.httpCode }
}

// The whole address of a service, protocol and all, kept exactly as it is typed: some of these live
// behind a name and a certificate and only the person typing knows which. The protocol picker fills
// in the one part a bare host:port leaves open, and nothing else about what was typed is touched.
export function UrlField({ field, value, onChange }: {
  field: PluginConfigField; value: string; onChange: (next: string) => void
}) {
  const { t } = useI18n()
  const printerId = useAddressCheckPrinter()
  const { checking, reach } = useServiceReach(value, answersAt, printerId)

  function pickScheme(scheme: string) {
    onChange(withScheme(value, scheme as ServiceScheme))
  }

  return (
    <>
      <div className="config-url">
        <select
          className="config-select"
          aria-label={t('store.address_protocol')}
          value={typedScheme(value) ?? ''}
          onChange={(event) => pickScheme(event.target.value)}
        >
          <option value="" disabled>{t('store.address_protocol')}</option>
          {SERVICE_SCHEMES.map((scheme) => <option key={scheme} value={scheme}>{scheme}</option>)}
        </select>
        <AddressInput placeholder={field.placeholder} value={value} onChange={onChange} />
      </div>
      <ReachNote checking={checking} reach={reach} shapeError={serviceUrlError(value)} triedFrom="printer" />
    </>
  )
}
