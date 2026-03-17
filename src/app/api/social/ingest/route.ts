import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ingestSocialForBrand } from '@/server/social/socialIngestionService'

/**
 * POST /api/social/ingest — trigger social ingestion for all brand products
 *
 * Called by:
 *  1. "Refresh" button on the Social page
 *  2. Cron job
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await ingestSocialForBrand(session.user.id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[social/ingest] error:', err)
    return NextResponse.json(
      { error: 'Ingestion failed', detail: String(err) },
      { status: 500 }
    )
  }
}
