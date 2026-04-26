interface Props {
  count: number
  timestamp: string
}

export default function AppointmentsTodayCard({ count, timestamp }: Props) {
  const time = new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-slate-800">Citas hoy</h2>
      <p className="text-7xl font-extrabold text-brand-600">{count}</p>
      <p className="mt-2 text-sm text-slate-400">Actualizado a las {time} UTC</p>

      <div className="mt-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
        <span className="font-medium">Zona horaria:</span> UTC — para local, ajusta en
        config
      </div>
    </div>
  )
}
