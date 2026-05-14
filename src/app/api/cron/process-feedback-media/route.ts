import { NextResponse } from 'next/server'
import { processPendingAudioFeedbackMedia, processPendingVideoFeedbackMedia } from '@/server/feedbackMediaProcessingService'
import { logger } from '@/lib/logger'

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
    const AUDIO_LIMIT = 10
    const VIDEO_LIMIT = 5
    const audioResult = await processPendingAudioFeedbackMedia({ limit: AUDIO_LIMIT })
    const videoResult = await processPendingVideoFeedbackMedia({ limit: VIDEO_LIMIT })

    const { success: _audioSuccess, ...audio } = audioResult as any
    const { success: _videoSuccess, ...video } = videoResult as any

    // If a batch was fully saturated, more rows are likely still pending.
    // Next cron run picks them up — log a warning so the backlog is visible
    // in production monitoring.
    const audioSaturated = (audio.processed ?? 0) >= AUDIO_LIMIT
    const videoSaturated = (video.processed ?? 0) >= VIDEO_LIMIT
    if (audioSaturated || videoSaturated) {
      logger.warn('[process-feedback-media] batch saturated — more items likely pending', {
        audioSaturated,
        videoSaturated,
        audioProcessed: audio.processed,
        videoProcessed: video.processed,
      })
    }

    logger.cronResult('process-feedback-media', true, { audio, video })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      audio,
      video,
    })
  } catch (error) {
    logger.cronResult('process-feedback-media', false, { error: error instanceof Error ? error.message : String(error) })
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

