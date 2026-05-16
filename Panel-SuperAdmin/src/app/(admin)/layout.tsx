import { redirect } from 'next/navigation'
import { getCurrentAdmin } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const admin = await getCurrentAdmin()
  if (!admin) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={admin.role} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar receives title via slot — pages override via <title> or a context.
            For simplicity we pass a generic title here; individual pages can render
            their own heading inside the content area. */}
        <Topbar email={admin.email} role={admin.role} title="GSentinel Super Admin" />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
