import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { findLatestDsarByConsumer } from '@/db/repositories/dsarRepository'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  if (role !== 'consumer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const record = await findLatestDsarByConsumer(userId)
  if (!record) {
    return NextResponse.json({ status: null })
  }

  const now = new Date()
  const expired = record.expiresAt && record.expiresAt < now && record.status === 'completed'

  const downloadUrl = record.status === 'completed' && !expired
    ? `${process.env.NEXTAUTH_URL ?? ''}/api/consumer/dsar/download/${record.id}`
    : undefined

  return NextResponse.json({
    requestId: record.id,
    status: expired ? 'expired' : record.status,
    createdAt: record.createdAt.toISOString(),
    otpExpiresAt: record.otpExpiresAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    downloadUrl,
    otpAttempts: record.otpAttempts,
    maxOtpAttempts: record.maxOtpAttempts,
  })
}
