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

const LOCALHOST_FALLBACK_BY_HOST: Record<string, string> = {
  'mb-chat': '127.0.0.1',
  'mb-secretaria': '127.0.0.1',
  'mb-whatsapp': '127.0.0.1',
  'brain': '127.0.0.1',
  'api': '127.0.0.1',
}

const HEALTH_PATHS = ['/health', '/api/health', '/api/health/readiness', '/api/health/liveness']

function buildHealthCandidates(baseUrl: string): string[] {
  const normalizedBase = baseUrl.replace(/\/+$/, '')
  const candidates = HEALTH_PATHS.map((p) => `${normalizedBase}${p}`)

  try {
    const parsed = new URL(baseUrl)
    const fallbackHost = LOCALHOST_FALLBACK_BY_HOST[parsed.hostname]
    if (fallbackHost) {
      const fallbackBase = `${parsed.protocol}//${fallbackHost}${parsed.port ? `:${parsed.port}` : ''}`
      for (const p of HEALTH_PATHS) {
        const fallbackUrl = `${fallbackBase}${p}`
        if (!candidates.includes(fallbackUrl)) {
          candidates.push(fallbackUrl)
        }
      }
    }
  } catch {
    // Invalid URL: keep direct candidates only.
  }

  return candidates
}

async function tryProbe(name: ServiceName, healthUrl: string, checkedAt: string): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), appConfig.health.timeoutMs)
    const response = await fetch(healthUrl, {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    const latencyMs = Date.now() - start

    if (!response.ok) {
      // 404 means the endpoint doesn't exist — treat as DOWN so the next candidate is tried.
      const status = response.status === 404 ? 'DOWN' : 'DEGRADED'
      return {
        name,
        url: healthUrl,
        status,
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
      name,
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
      name,
      url: healthUrl,
      status: 'DOWN',
      latencyMs,
      checkedAt,
      error: isTimeout ? 'timeout' : (error instanceof Error ? error.message : 'unknown error'),
    }
  }
}

async function probeService(endpoint: ServiceEndpoint): Promise<ServiceHealth> {
  const start = Date.now()
  const checkedAt = new Date().toISOString()
  const healthCandidates = buildHealthCandidates(endpoint.url)
  const failures: string[] = []

  for (const healthUrl of healthCandidates) {
    const result = await tryProbe(endpoint.name, healthUrl, checkedAt)
    if (result.status === 'UP' || result.status === 'DEGRADED') {
      return result
    }
    failures.push(`${healthUrl}: ${result.error ?? result.status}`)
  }

  return {
    name: endpoint.name,
    url: healthCandidates[0] ?? `${endpoint.url}/health`,
    status: 'DOWN',
    latencyMs: Date.now() - start,
    checkedAt,
    error: failures.join(' | ') || 'unknown error',
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
