import { appConfig } from '@/config/app.config'
import type { ServiceHealth, ServiceName, ServiceStatus, SystemHealthReport } from '@/modules/system-health/health.types'

interface ServiceEndpoint {
  name: ServiceName
  url: string
}

const SERVICES: ServiceEndpoint[] = [
  { name: 'MB-Chat', url: appConfig.services.mbChat },
  { name: 'MB-Secretaria', url: appConfig.services.mbSecretaria },
  { name: 'MB-Whatsapp', url: appConfig.services.mbWhatsapp },
  { name: 'Brain Core', url: appConfig.services.brainCore },
  { name: 'Agenda API', url: appConfig.services.agendaApi },
]

async function probeService(endpoint: ServiceEndpoint): Promise<ServiceHealth> {
  const start = Date.now()
  const checkedAt = new Date().toISOString()
  const healthUrl = `${endpoint.url}/health`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), appConfig.health.timeoutMs)

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      // next.js fetch cache: no-store for live health checks
      cache: 'no-store',
    })
    clearTimeout(timer)

    const latencyMs = Date.now() - start

    if (!response.ok) {
      return {
        name: endpoint.name,
        url: healthUrl,
        status: 'DEGRADED',
        latencyMs,
        checkedAt,
        error: `HTTP ${response.status}`,
      }
    }

    let version: string | undefined
    try {
      const body = await response.json()
      version = body?.version ?? body?.info?.version
    } catch {
      // health endpoint may return plain text — that's fine
    }

    return {
      name: endpoint.name,
      url: healthUrl,
      status: 'UP',
      latencyMs,
      version,
      checkedAt,
    }
  } catch (error) {
    const latencyMs = Date.now() - start
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return {
      name: endpoint.name,
      url: healthUrl,
      status: 'DOWN',
      latencyMs,
      checkedAt,
      error: isTimeout ? 'timeout' : (error instanceof Error ? error.message : 'unknown error'),
    }
  }
}

function aggregateStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.every((s) => s === 'UP')) return 'UP'
  if (statuses.some((s) => s === 'DOWN')) return 'DOWN'
  if (statuses.some((s) => s === 'DEGRADED')) return 'DEGRADED'
  return 'UNKNOWN'
}

export async function getSystemHealth(): Promise<SystemHealthReport> {
  const results = await Promise.all(SERVICES.map(probeService))

  return {
    overallStatus: aggregateStatus(results.map((r) => r.status)),
    services: results,
    checkedAt: new Date().toISOString(),
  }
}
