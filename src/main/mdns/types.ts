export interface DiscoveredPrinterRecord {
  id: string
  host: string
  ip: string
  model: string
  vendor: string
  service: string
  mac?: string
}

export interface MdnsRecord {
  type: string
  name: string
  data: unknown
  ttl: number
}

export interface SrvData {
  target: string
  port: number
  weight: number
  priority: number
}
