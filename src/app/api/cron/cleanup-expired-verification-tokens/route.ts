/**
 * Cron: Cleanup expired email verification tokens (Phase EV.1)
 * GET /api/cron/cleanup-expired-verification-tokens
 *
 * Runs daily at 04:00 UTC (see vercel.json) — same cadence as
 * cleanup-trusted-devices and the other auth-table sweeps.
 *
 * Deletes email_verification_tokens rows past their expiry + 7-day
 * grace window. Expired tokens are also rejected lazily at verify
 * time (verifyEmailToken returns reason='expired'); this cron is the
 * sweep so the table doesn't grow forever.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically;
 * cron-job.org and manual triggers must include it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredTokens } from '@/server/emailVerificationService'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { deleted } = await cleanupExpiredTokens()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      emailVerificationTokensDeleted: deleted,
    })
  } catch (err: any) {
    console.error('[cron/cleanup-expired-verification-tokens]', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    )
  }
}
