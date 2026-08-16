/**
 * Community Deals Moderation Cron
 * GET /api/cron/community-deals-moderation
 *
 * Schedule: every 30 min (vercel.json)
 *
 * 1. Auto-approve pending posts older than 30 min
 * 2. Process upvote milestone bonuses (100+ upvotes → 50 points)
 * 3. Auto-hide content with 5+ flags
 *
 * Auth: CRON_SECRET via Authorization: Bearer header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withCronRun } from '@/lib/cron/withCronRun'
import {
  autoApprovePendingPosts,
  processUpvoteMilestones,
  autoHideFlaggedContent,
} from '@/server/dealsModerationService'

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || process.env.AUTH_SECRET
  return authHeader === `Bearer ${cronSecret}`
}

// Run-recording (migration 037). ⚠️ This route's `verifyAuth` uses
// CRON_SECRET || AUTH_SECRET and always compares — different from the
// majority pattern. Left completely untouched inside the handler so wrapping
// cannot alter it.
export const GET = withCronRun('community-deals-moderation', handleGET)

async function handleGET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [approved, milestones, hidden] = await Promise.all([
      autoApprovePendingPosts(30),
      processUpvoteMilestones(100),
      autoHideFlaggedContent(),
    ])

    return NextResponse.json({
      success: true,
      message: `Auto-approved ${approved.approved}, milestones ${milestones.processed}, hidden ${hidden.hidden}`,
      ...approved,
      ...milestones,
      ...hidden,
    })
  } catch (error) {
    console.error('[Cron community-deals-moderation] Error:', error)
    return NextResponse.json(
      { error: 'Cron failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
