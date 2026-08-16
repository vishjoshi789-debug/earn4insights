import { NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/withCronRun'
import { cleanupOldAudioMedia, cleanupOldVideoMedia } from '@/server/feedbackMediaRetentionService'
import { logger } from '@/lib/logger'

/**
 * Cron: Cleanup old raw feedback media (retention)
 *
 * Trigger: Vercel Cron (recommended daily)
 * Manual trigger: GET /api/cron/cleanup-feedback-media
 */
// Run-recording (migration 037). Auth left inline, unchanged.
export const GET = withCronRun('cleanup-feedback-media', handleGET)

async function handleGET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const audio = await cleanupOldAudioMedia({ limit: 50 })
    const video = await cleanupOldVideoMedia({ limit: 50 })
    logger.cronResult('cleanup-feedback-media', true, { audio, video })

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
    logger.cronResult('cleanup-feedback-media', false, { error: error instanceof Error ? error.message : String(error) })
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

