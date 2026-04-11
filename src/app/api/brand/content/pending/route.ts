/**
 * Brand Pending Content
 * GET /api/brand/content/pending
 *
 * Returns all pending_review posts for campaigns owned by this brand.
 * Includes SLA countdown per post.
 *
 * Access: authenticated brand users
 */

import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPendingPostsForBrand } from '@/db/repositories/contentApprovalRepository'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'brand') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const posts = await getPendingPostsForBrand(userId)

    // Compute SLA status for each post
    const now = Date.now()
    const enriched = posts.map(post => {
      let slaStatus: { hoursRemaining: number | null; slaPct: number | null; status: string } = {
        hoursRemaining: null,
        slaPct: null,
        status: 'no_sla',
      }

      if (post.reviewSlaHours && post.reviewSubmittedAt) {
        const elapsedMs = now - new Date(post.reviewSubmittedAt).getTime()
        const elapsedHours = elapsedMs / (1000 * 60 * 60)
        const remaining = post.reviewSlaHours - elapsedHours
        const pct = (elapsedHours / post.reviewSlaHours) * 100

        let status = 'green'          // > 50% remaining
        if (pct >= 100) status = 'expired'
        else if (pct >= 75) status = 'red'    // < 25% remaining
        else if (pct >= 50) status = 'yellow' // 25-50% remaining

        slaStatus = {
          hoursRemaining: Math.max(0, Math.round(remaining * 10) / 10),
          slaPct: Math.round(pct * 10) / 10,
          status,
        }
      }

      return { ...post, slaStatus }
    })

    return NextResponse.json({ posts: enriched, total: enriched.length })
  } catch (error) {
    console.error('[BrandPendingContent GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
