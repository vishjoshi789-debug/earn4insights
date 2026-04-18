/**
 * Deals Expiry Cron
 * GET /api/cron/deals-expiry
 *
 * Schedule: every hour (vercel.json)
 *
 * 1. Find active deals past valid_until → mark expired
 * 2. Notify consumers who saved expired deals
 *
 * Auth: CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { processExpiredDeals } from '@/server/dealsModerationService'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processExpiredDeals()
    return NextResponse.json({
      success: true,
      message: `Processed ${result.processed} expired deals`,
      ...result,
    })
  } catch (error) {
    console.error('[Cron deals-expiry] Error:', error)
    return NextResponse.json(
      { error: 'Cron failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
