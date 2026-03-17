import { NextRequest, NextResponse } from 'next/server'
import { ingestSocialForAllEnabled } from '@/server/social/socialIngestionService'

/**
 * POST /api/social/cron — scheduled social ingestion
 *
 * Protected by CRON_SECRET header check.
 * Configure in Vercel: Cron schedule → POST /api/social/cron
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await ingestSocialForAllEnabled()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[social/cron] error:', err)
    return NextResponse.json(
      { error: 'Cron ingestion failed', detail: String(err) },
      { status: 500 }
    )
  }
}
