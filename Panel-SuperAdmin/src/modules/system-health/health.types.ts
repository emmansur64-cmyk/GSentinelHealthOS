export type ServiceName =
  | 'MB-Chat'
  | 'MB-Secretaria'
  | 'MB-Whatsapp'
  | 'Brain Core'
  | 'Agenda API'

export type ServiceStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN'

export interface ServiceHealth {
  name: ServiceName
  url: string
  status: ServiceStatus
  latencyMs?: number
  version?: string
  checkedAt: string
  error?: string
}

export interface SystemHealthReport {
  overallStatus: ServiceStatus
  services: ServiceHealth[]
  checkedAt: string
}
