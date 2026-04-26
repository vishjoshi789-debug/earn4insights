import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import {
  findExpiredCompletedRequests,
  findStaleOtpRequests,
  updateDsarRequest,
} from '@/db/repositories/dsarRepository'

/**
 * Cron: DSAR Cleanup
 * GET /api/jobs/dsar-cleanup
 *
 * Runs daily at 03:00 UTC.
 * 1. Finds completed dsar_requests where expires_at < NOW()
 *    → deletes PDF from Vercel Blob, sets status='expired', clears pdf_url
 * 2. Finds otp_sent requests where otp_expires_at < NOW() - 1 hour (stale)
 *    → sets status='expired'
 *
 * Auth: Bearer CRON_SECRET
 */
function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  let pdfDeleted = 0
  let otpExpired = 0
  const errors: string[] = []

  try {
    // 1. Expired completed requests — delete blobs
    const expiredCompleted = await findExpiredCompletedRequests()
    for (const record of expiredCompleted) {
      try {
        if (record.pdfUrl) {
          await del(record.pdfUrl)
        }
        await updateDsarRequest(record.id, { status: 'expired', pdfUrl: null })
        pdfDeleted++
      } catch (err) {
        errors.push(`PDF cleanup ${record.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // 2. Stale OTP requests
    const staleOtpRecords = await findStaleOtpRequests()
    for (const record of staleOtpRecords) {
      try {
        await updateDsarRequest(record.id, { status: 'expired' })
        otpExpired++
      } catch (err) {
        errors.push(`OTP expiry ${record.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      pdfDeleted,
      otpExpired,
      errors: errors.length > 0 ? errors : undefined,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Cron dsar-cleanup] Fatal:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
