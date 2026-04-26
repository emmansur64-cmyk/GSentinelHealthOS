export interface BotHealth {
  resets: number
  contention: number
  messages_processed: number
  reset_ratio: number
  contention_ratio: number
}

export interface QueueHealth {
  incoming: number | null
  outgoing: number | null
  backlog_high: boolean
}

export interface Alerts {
  lock_contention_high: boolean
  queue_backlog_high: boolean
  system_reset_ratio_high: boolean
}

export interface DashboardStats {
  appointments_today: number
  bot_health: BotHealth
  queue_health: QueueHealth
  alerts: Alerts
  redis_connected: boolean
  status: string
  timestamp: string
}
