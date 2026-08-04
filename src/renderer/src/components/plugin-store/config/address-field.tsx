// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PluginConfigField } from '../../../data/types'
import { cleanServiceAddress, serviceAddress, serviceAddressError } from '../../../data/address'
import { AddressInput } from './address-input'
import type { ServiceReach } from './reach-note'
import { ReachNote } from './reach-note'
import { useServiceReach } from './use-service-reach'

async function answersAt(address: string): Promise<ServiceReach | null> {
  const service = serviceAddress(address)
  if (!service) return null

  return { address, answered: await window.b3d.net.probeService(service.host, service.port) }
}

// A host or host:port field. Whatever is in it is checked as soon as it stands still and reads as an
// address; leaving the field additionally tidies what was typed, so a pasted browser link becomes the
// host and port the plugin asks for.
export function AddressField({ field, value, onChange }: {
  field: PluginConfigField; value: string; onChange: (next: string) => void
}) {
  const { checking, reach } = useServiceReach(value, answersAt)

  function tidyWhatWasPasted() {
    const cleaned = cleanServiceAddress(value)
    if (cleaned !== value) onChange(cleaned)
  }

  return (
    <>
      <AddressInput placeholder={field.placeholder} value={value} onChange={onChange} onLeave={tidyWhatWasPasted} />
      <ReachNote checking={checking} reach={reach} shapeError={serviceAddressError(value)} />
    </>
  )
}
