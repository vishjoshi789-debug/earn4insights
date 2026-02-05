import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/server'
import { processPendingAudioFeedbackMedia, processPendingVideoFeedbackMedia } from '@/server/feedbackMediaProcessingService'

function authErrorToStatus(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.toLowerCase().includes('forbidden')) return 403
  return 401
}

/**
 * POST /api/dashboard/feedback-media/process-now
 *
 * Brand-only manual trigger for processing (useful for debugging without waiting for cron).
 * Gated by env var to avoid accidental cost spikes in production.
 */
export async function POST() {
  try {
    await requireRole('brand')
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: authErrorToStatus(err) })
  }

  if (process.env.ALLOW_MANUAL_MEDIA_PROCESSING !== 'true') {
    return NextResponse.json({ error: 'Manual processing is disabled' }, { status: 403 })
  }

  try {
    const audioResult = await processPendingAudioFeedbackMedia({ limit: 10 })
    const videoResult = await processPendingVideoFeedbackMedia({ limit: 5 })

    const { success: _audioSuccess, ...audio } = audioResult as any
    const { success: _videoSuccess, ...video } = videoResult as any

    return NextResponse.json({ success: true, audio, video })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

