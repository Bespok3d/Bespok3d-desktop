import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Plugin, Repository, SourceRow, CatalogPayload } from '../types'
import type { Collection } from '../collections'
import { indexToPlugins, indexToCollections, payloadToRegistry, toCatalogPayload } from './shape'

interface CatalogData {
  plugins: Plugin[]
  collections: Collection[]
  registry: Repository | null
  sources: SourceRow[]
  loading: boolean
  error: string | null
}

export interface CatalogState extends CatalogData {
  setSourceEnabled: (url: string, enabled: boolean) => void
  // Re-read the catalog from disk/network. Used after the local store changes (a dropped package
  // ingested or removed), on git-host connect/disconnect, and from the store's manual refresh. Returns
  // a promise so a caller can show progress; it does not flip `loading` (the store stays visible).
  refresh: () => Promise<void>
}

const INITIAL: CatalogData = { plugins: [], collections: [], registry: null, sources: [], loading: true, error: null }
const CatalogContext = createContext<CatalogState>({ ...INITIAL, setSourceEnabled: () => {}, refresh: () => Promise.resolve() })

export function useCatalog(): CatalogState {
  return useContext(CatalogContext)
}

type SetData = (next: CatalogData) => void

function applyPayload(setData: SetData, payload: CatalogPayload): void {
  setData({ plugins: indexToPlugins(payload.plugins, payload.sources), collections: indexToCollections(payload.collections), registry: payloadToRegistry(payload), sources: payload.sources, loading: false, error: null })
}

function fail(setData: SetData, error: Error): void {
  setData({ plugins: [], collections: [], registry: null, sources: [], loading: false, error: error.message })
}

function fetchCatalog(setData: SetData): Promise<void> {
  return window.b3d.registry.catalog().then((wire) => applyPayload(setData, toCatalogPayload(wire))).catch((error: Error) => fail(setData, error))
}

function toggleSource(setData: SetData, url: string, enabled: boolean): void {
  window.b3d.registry.setSourceEnabled(url, enabled).then((wire) => applyPayload(setData, toCatalogPayload(wire))).catch((error: Error) => fail(setData, error))
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CatalogData>(INITIAL)
  useEffect(() => { fetchCatalog(setData) }, [])
  const value: CatalogState = {
    ...data,
    setSourceEnabled: (url, enabled) => toggleSource(setData, url, enabled),
    refresh: () => fetchCatalog(setData),
  }

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
