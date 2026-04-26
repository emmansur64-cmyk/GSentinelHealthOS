import { useEffect, useRef, useState } from 'react'
import type { DashboardStats } from '../types/api'

const POLL_INTERVAL_MS = 15_000
const MAX_HISTORY = 20

export interface HistoryPoint {
  time: string
  reset_ratio: number
  contention_ratio: number
}

export interface DashboardState {
  stats: DashboardStats | null
  history: HistoryPoint[]
  loading: boolean
  error: string | null
}

export function useDashboard(): DashboardState {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function fetchStats() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      const res = await fetch('/api/v1/dashboard/stats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DashboardStats = await res.json()
      setStats(data)
      setError(null)
      setHistory((prev: HistoryPoint[]) => {
        const point: HistoryPoint = {
          time: new Date(data.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          reset_ratio: data.bot_health.reset_ratio,
          contention_ratio: data.bot_health.contention_ratio,
        }
        const next = [...prev, point]
        return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return { stats, history, loading, error }
}
