// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { I18nProvider } from '../i18n/context'
import type { I18nValue } from '../i18n/context'
import { makeT } from '../i18n'
import { CatalogProvider } from '../data/catalog'
import type { IndexEntry } from '../data/types'
import { installB3d } from './b3d-mock'
import type { B3dOverrides, Emit, B3d } from './b3d-mock'
import { makeCatalogPayload } from './fixtures'

afterEach(cleanup)

function noop() {}

export function realI18nValue(): I18nValue {
  return { locale: 'en', t: makeT('en'), setLocale: noop, customLocales: {}, setCustomTranslations: noop }
}

export interface ProviderOptions {
  withCatalog?: boolean
  catalog?: IndexEntry[]
  b3d?: B3dOverrides
}

function catalogOverride(options: ProviderOptions): B3dOverrides {
  var catalog = vi.fn().mockResolvedValue(makeCatalogPayload(options.catalog ?? []))
  if (!options.catalog) return options.b3d ?? {}

  return { ...options.b3d, registry: { catalog, ...options.b3d?.registry } }
}

function makeWrapper(withCatalog: boolean) {
  function Wrapper({ children }: { children: ReactNode }) {
    var inner = withCatalog ? <CatalogProvider>{children}</CatalogProvider> : children

    return <I18nProvider value={realI18nValue()}>{inner}</I18nProvider>
  }

  return Wrapper
}

export interface Harness {
  user: ReturnType<typeof userEvent.setup>
  emit: Emit
  b3d: B3d
}

export function setup(ui: ReactElement, options: ProviderOptions = {}): Harness & ReturnType<typeof render> {
  var installed = installB3d(catalogOverride(options))
  var user = userEvent.setup()
  var result = render(ui, { wrapper: makeWrapper(options.withCatalog ?? false) })

  return { user, emit: installed.emit, b3d: installed.b3d, ...result }
}
