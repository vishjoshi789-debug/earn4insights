import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { importJobs } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

/**
 * GET /api/import/jobs — Fetch import history for the current brand user
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as any).role !== 'brand') {
      return NextResponse.json({ error: 'Only brand users can view import history' }, { status: 403 })
    }

    const jobs = await db.select().from(importJobs)
      .where(eq(importJobs.brandId, session.user.id))
      .orderBy(desc(importJobs.createdAt))
      .limit(50)

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('[Import Jobs] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch import history' }, { status: 500 })
  }
}
