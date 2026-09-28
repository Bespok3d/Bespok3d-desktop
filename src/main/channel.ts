// SPDX-FileCopyrightText: Copyright (C) 2026 Luciano Colosio
import channelTable from '../../scripts/channel-table.json'

export type BuildFlavor = keyof typeof channelTable
export type AppChannel = (typeof channelTable)[BuildFlavor]

export const APP_CHANNEL: AppChannel = channelTable[typeof __B3D_CHANNEL__ === 'undefined' ? 'development' : __B3D_CHANNEL__]
export const APP_CHANNELS = Object.values(channelTable) as AppChannel[]

export function officialIndexUrl(channel: AppChannel): string {
  return `github:Bespok3d/main-index/${channel.indexAssets[0]}`
}

export function releaseRepository(channel: AppChannel): { owner: string; repo: string } | null {
  const repository = channel.releaseRepository
  if (!repository) return null
  const [owner, repo] = repository.split('/')

  return { owner, repo }
}
