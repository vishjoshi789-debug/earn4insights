/**
 * Cron: Cleanup expired trusted devices
 * GET /api/cron/cleanup-trusted-devices
 *
 * Runs daily at 04:00 UTC (see vercel.json).
 *
 * Deletes trusted_devices rows whose 30-day window has elapsed. Expired
 * rows are also pruned lazily on read (isDeviceTrusted), so this cron is
 * a sweep for devices that simply stopped being used.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredDevices } from '@/server/twoFactorService'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const trustedDevicesDeleted = await cleanupExpiredDevices()
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      trustedDevicesDeleted,
    })
  } catch (err: any) {
    console.error('[cron/cleanup-trusted-devices]', err)
    return NextResponse.json(
      { success: false, error: err?.message ?? String(err) },
      { status: 500 },
    )
  }
}
