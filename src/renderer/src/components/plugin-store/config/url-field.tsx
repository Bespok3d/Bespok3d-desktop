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

// Answering at all is what the plugin needs, so a redirect counts; an error code means something is
// there but not serving this address, which is worth saying and never worth blocking on.
const FIRST_ERROR_CODE = 400

async function answersAt(address: string): Promise<ServiceReach | null> {
  if (serviceUrlError(address)) return null
  const httpCode = await window.b3d.net.probeServiceUrl(address.trim())
  if (httpCode === null) return { address, answered: false }

  return { address, answered: httpCode < FIRST_ERROR_CODE, httpCode }
}

// The whole address of a service, protocol and all, kept exactly as it is typed: some of these live
// behind a name and a certificate and only the person typing knows which. The protocol picker fills
// in the one part a bare host:port leaves open, and nothing else about what was typed is touched.
export function UrlField({ field, value, onChange }: {
  field: PluginConfigField; value: string; onChange: (next: string) => void
}) {
  const { t } = useI18n()
  const { checking, reach } = useServiceReach(value, answersAt)

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
      <ReachNote checking={checking} reach={reach} shapeError={serviceUrlError(value)} />
    </>
  )
}
