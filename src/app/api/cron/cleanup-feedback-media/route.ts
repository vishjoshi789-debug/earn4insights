import { NextResponse } from 'next/server'
import { cleanupOldAudioMedia, cleanupOldVideoMedia } from '@/server/feedbackMediaRetentionService'

/**
 * Cron: Cleanup old raw feedback media (retention)
 *
 * Trigger: Vercel Cron (recommended daily)
 * Manual trigger: GET /api/cron/cleanup-feedback-media
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const audio = await cleanupOldAudioMedia({ limit: 50 })
    const video = await cleanupOldVideoMedia({ limit: 50 })
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      audio: (() => {
        const { success, ...rest } = audio as any
        return rest
      })(),
      video: (() => {
        const { success, ...rest } = video as any
        return rest
      })(),
    })
  } catch (error) {
    console.error('[CleanupFeedbackMediaCron] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

