interface Props {
  label: string
  active: boolean
  activeLabel?: string
  inactiveLabel?: string
}

export default function AlertBadge({
  label,
  active,
  activeLabel = 'ALERTA',
  inactiveLabel = 'OK',
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        active
          ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
          : 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-red-500' : 'bg-emerald-500'}`}
      />
      {label}: {active ? activeLabel : inactiveLabel}
    </span>
  )
}
