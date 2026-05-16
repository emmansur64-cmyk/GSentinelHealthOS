import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/auth'

export async function GET(): Promise<NextResponse> {
  const admin = await getCurrentAdmin()

  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    id: admin.sub,
    email: admin.email,
    role: admin.role,
  })
}
