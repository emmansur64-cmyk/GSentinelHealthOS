import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ModuleCardProps {
  title: string
  description: string
  icon: LucideIcon
  href: string
  badge?: string
  className?: string
}

export function ModuleCard({ title, description, icon: Icon, href, badge, className }: ModuleCardProps) {
  return (
    <a
      href={href}
      className={cn(
        'group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        'hover:border-indigo-300 hover:shadow-md transition-all duration-150',
        className,
      )}
    >
      <div className="flex-shrink-0 rounded-lg bg-indigo-50 p-2.5 group-hover:bg-indigo-100 transition-colors">
        <Icon className="h-5 w-5 text-indigo-600" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {badge && (
            <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{description}</p>
      </div>
    </a>
  )
}
