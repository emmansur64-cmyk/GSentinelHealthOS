'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ROLE_LABELS } from '@/modules/rbac/roles'
import type { AdminRole } from '@/modules/rbac/roles'

interface TopbarProps {
  email: string
  role: AdminRole
  title: string
}

export function Topbar({ email, role, title }: TopbarProps) {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900 leading-tight">{email}</p>
          <p className="text-xs text-slate-400">{ROLE_LABELS[role]}</p>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Logout</span>
        </button>
      </div>
    </header>
  )
}
