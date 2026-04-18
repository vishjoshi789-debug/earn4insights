/**
 * GET /api/admin/community-deals/flagged
 *
 * List content with 3+ pending flags for admin review. Admin only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getFlaggedContent } from '@/server/dealsModerationService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const flagged = await getFlaggedContent()
    return NextResponse.json({ flagged })
  } catch (error) {
    console.error('[AdminFlaggedContent GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
