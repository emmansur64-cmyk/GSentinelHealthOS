'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  Building2,
  Flag,
  ScrollText,
  Settings2,
  ShieldCheck,
  UserPlus,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminRole } from '@/modules/rbac/roles'
import { MODULE_ACCESS } from '@/modules/rbac/roles'
import { canAccess } from '@/modules/rbac/roles'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  moduleKey: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'System Health', href: '/system-health', icon: Activity, moduleKey: 'system-health' },
  { label: 'Tenants', href: '/tenants', icon: Building2, moduleKey: 'tenants' },
  { label: 'Alta Cliente', href: '/client-onboarding', icon: UserPlus, moduleKey: 'client-onboarding' },
  { label: 'AI Providers', href: '/ai-providers', icon: Zap, moduleKey: 'ai-providers' },
  { label: 'Feature Flags', href: '/feature-flags', icon: Flag, moduleKey: 'feature-flags' },
  { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, moduleKey: 'audit-logs' },
]

interface SidebarProps {
  role: AdminRole
  appVersion: string
}

export function Sidebar({ role, appVersion }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => {
    const allowed = MODULE_ACCESS[item.moduleKey]
    return allowed ? canAccess(role, allowed) : false
  })

  return (
    <aside className="flex h-full w-60 flex-col" style={{ backgroundColor: 'var(--sidebar-bg)' }}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-slate-700/50 px-5">
        <ShieldCheck className="h-6 w-6 text-indigo-400" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">GSentinel</p>
          <p className="text-xs text-slate-400">Super Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          <li className="mb-3">
            <Link
              href="/dashboard"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === '/dashboard'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100',
              )}
            >
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              Dashboard
            </Link>
          </li>

          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-100',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-700/50 px-4 py-3">
        <p className="text-xs text-slate-500">
          v{appVersion}
        </p>
      </div>
    </aside>
  )
}
