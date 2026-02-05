import { NextResponse } from 'next/server'
import { processPendingAudioFeedbackMedia, processPendingVideoFeedbackMedia } from '@/server/feedbackMediaProcessingService'

/**
 * Cron: Process pending feedback media (audio + video) (STT → translate → sentiment)
 *
 * Trigger: Vercel Cron (recommended every 5-15 minutes)
 * Manual trigger: GET /api/cron/process-feedback-media
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const audioResult = await processPendingAudioFeedbackMedia({ limit: 10 })
    const videoResult = await processPendingVideoFeedbackMedia({ limit: 5 })

    const { success: _audioSuccess, ...audio } = audioResult as any
    const { success: _videoSuccess, ...video } = videoResult as any

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      audio,
      video,
    })
  } catch (error) {
    console.error('[ProcessFeedbackMediaCron] Error:', error)
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

