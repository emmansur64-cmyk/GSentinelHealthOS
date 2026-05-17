import { Activity, Building2, Flag, ScrollText, UserPlus, Zap } from 'lucide-react'
import { ModuleCard } from '@/components/module-card'
import { getCurrentAdmin } from '@/lib/auth'
import { ROLE_LABELS } from '@/modules/rbac/roles'

export default async function DashboardPage() {
  const admin = await getCurrentAdmin()

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          {admin ? `Signed in as ${admin.email} · ${ROLE_LABELS[admin.role]}` : ''}
        </p>
      </div>

      {/* Module grid */}
      <section>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Administration Modules
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            title="System Health"
            description="Real-time status of MB-Chat, MB-Secretaria, MB-Whatsapp, Brain Core, and Agenda API."
            icon={Activity}
            href="/system-health"
          />
          <ModuleCard
            title="Tenant Management"
            description="List, activate, suspend, and configure tenants across the platform."
            icon={Building2}
            href="/tenants"
          />
          <ModuleCard
            title="Alta Cliente"
            description="Alta operativa de clínica con credenciales de cliente, secretaria y médicos."
            icon={UserPlus}
            href="/client-onboarding"
          />
          <ModuleCard
            title="AI Providers"
            description="Configure Groq, OpenAI, and Anthropic provider keys, models, and fallback behavior."
            icon={Zap}
            href="/ai-providers"
          />
          <ModuleCard
            title="Feature Flags"
            description="Toggle global and per-tenant feature flags at runtime without redeployment."
            icon={Flag}
            href="/feature-flags"
          />
          <ModuleCard
            title="Audit Logs"
            description="Track all administrative actions, configuration changes, and access events."
            icon={ScrollText}
            href="/audit-logs"
          />
        </div>
      </section>

      {/* Architecture note */}
      <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-5">
        <p className="text-sm font-semibold text-indigo-900">Architecture</p>
        <pre className="mt-2 text-xs text-indigo-700 leading-relaxed font-mono whitespace-pre-wrap">
          Panel-SuperAdmin (port 3010)
              ↓
          Admin API / Config API
              ↓
          MB-Chat · MB-Secretaria · MB-Whatsapp
              ↓
          Brain Core
              ↓
          Agenda API → PostgreSQL
        </pre>
      </section>
    </div>
  )
}
