import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { verifyOTP } from '@/server/dsarService'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  if (role !== 'consumer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { requestId?: string; otp?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { requestId, otp } = body
  if (!requestId || !otp) {
    return NextResponse.json({ error: 'requestId and otp are required' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'OTP must be 6 digits' }, { status: 400 })
  }

  try {
    const result = await verifyOTP(requestId, userId, otp)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
