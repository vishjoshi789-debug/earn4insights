import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { initiateRequest } from '@/server/dsarService'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  if (role !== 'consumer') {
    return NextResponse.json({ error: 'Only consumers can request data exports.' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? undefined
  const ua = request.headers.get('user-agent') ?? undefined

  try {
    const result = await initiateRequest(userId, session.user.email, ip, ua)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to initiate request'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
