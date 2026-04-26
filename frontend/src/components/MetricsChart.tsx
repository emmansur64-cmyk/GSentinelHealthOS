import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistoryPoint } from '../hooks/useDashboard'

interface Props {
  history: HistoryPoint[]
}

const STROKE_RESET = '#ef4444'
const STROKE_CONTENTION = '#0ea5e9'

export default function MetricsChart({ history }: Props) {
  const hasData = history.length >= 2

  if (!hasData) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-400 shadow-sm">
        Acumulando lecturas para la serie temporal… (mínimo 2 puntos)
      </div>
    )
  }

  // Formato porcentaje para eje Y
  const tickFormatter = (v: number) => `${(v * 100).toFixed(0)}%`
  const tooltipFormatter = (v: number, name: string) => [
    `${(v * 100).toFixed(2)}%`,
    name,
  ]

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Ratios en tiempo real</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={tickFormatter}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '1px solid #e2e8f0',
              fontSize: '0.75rem',
            }}
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.75rem' }}
          />
          <Line
            type="monotone"
            dataKey="reset_ratio"
            name="Reset ratio"
            stroke={STROKE_RESET}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="contention_ratio"
            name="Contention ratio"
            stroke={STROKE_CONTENTION}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
