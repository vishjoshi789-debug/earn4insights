import { NextResponse } from 'next/server'
import { processPendingNotifications } from '@/server/notificationService'
import { logger } from '@/lib/logger'

// This endpoint should be called by a cron job every 5 minutes
// In Vercel, you can use Vercel Cron Jobs for this
export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await processPendingNotifications()
    logger.cronResult('process-notifications', true)
    return NextResponse.json({ success: true, message: 'Processed pending notifications' })
  } catch (error) {
    console.error('CRON ERROR [process-notifications]:', error)
    logger.cronResult('process-notifications', false, { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
