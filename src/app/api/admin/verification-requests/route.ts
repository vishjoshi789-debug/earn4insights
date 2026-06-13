import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users, influencerProfiles, influencerVerificationRequests } from '@/db/schema'

/**
 * A9 — Admin verification queue list.
 *
 * GET /api/admin/verification-requests?status=manual_review
 *
 * Returns the most recent verification requests filtered by status.
 * Default status filter: `'manual_review'` (the actual admin queue).
 * Pass `?status=all` to see everything (debugging / history).
 *
 * Each row is joined with the user's email + influencer display name
 * + the threshold-check result snapshot so the admin queue UI doesn't
 * need a second fetch per row.
 *
 * Admin role required. Mirrors the `/admin/payouts` GET pattern.
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const statusParamRaw = url.searchParams.get('status') ?? 'manual_review'
  // Narrow the URL-string into the column's union type. Anything not in
  // the allow-list (other than the sentinel 'all') falls back to the
  // default queue filter.
  const VALID_STATUSES = [
    'pending', 'auto_approved', 'auto_rejected', 'manual_review',
    'approved', 'rejected', 'needs_info',
  ] as const
  type Status = typeof VALID_STATUSES[number]
  const statusParam: Status | 'all' =
    statusParamRaw === 'all'
      ? 'all'
      : (VALID_STATUSES as readonly string[]).includes(statusParamRaw)
      ? (statusParamRaw as Status)
      : 'manual_review'

  const baseQuery = db
    .select({
      id: influencerVerificationRequests.id,
      userId: influencerVerificationRequests.userId,
      status: influencerVerificationRequests.status,
      applicationMessage: influencerVerificationRequests.applicationMessage,
      brandContactNotes: influencerVerificationRequests.brandContactNotes,
      portfolioLinks: influencerVerificationRequests.portfolioLinks,
      thresholdCheckResult: influencerVerificationRequests.thresholdCheckResult,
      reviewNotes: influencerVerificationRequests.reviewNotes,
      reviewedAt: influencerVerificationRequests.reviewedAt,
      eligibleToReapplyAt: influencerVerificationRequests.eligibleToReapplyAt,
      createdAt: influencerVerificationRequests.createdAt,
      updatedAt: influencerVerificationRequests.updatedAt,
      userEmail: users.email,
      userName: users.name,
      displayName: influencerProfiles.displayName,
      profileImageUrl: influencerProfiles.profileImageUrl,
      currentVerificationStatus: influencerProfiles.verificationStatus,
    })
    .from(influencerVerificationRequests)
    .leftJoin(users, eq(users.id, influencerVerificationRequests.userId))
    .leftJoin(influencerProfiles, eq(influencerProfiles.userId, influencerVerificationRequests.userId))

  const rows = statusParam === 'all'
    ? await baseQuery
        .orderBy(desc(influencerVerificationRequests.createdAt))
        .limit(200)
    : await baseQuery
        .where(eq(influencerVerificationRequests.status, statusParam))
        .orderBy(desc(influencerVerificationRequests.createdAt))
        .limit(200)

  return NextResponse.json({ requests: rows, statusFilter: statusParam })
}
