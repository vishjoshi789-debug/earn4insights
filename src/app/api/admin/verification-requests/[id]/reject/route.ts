import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { influencerProfiles, influencerVerificationRequests, auditLog } from '@/db/schema'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { VERIFICATION_THRESHOLDS } from '@/lib/config/verificationThresholds'

/**
 * A9 — Admin reject a manual_review verification request.
 *
 * POST /api/admin/verification-requests/[id]/reject
 *
 * Body:
 *   { reviewNotes: string }  // REQUIRED — explanation shown to user
 *
 * Allowed only when the request is in `'manual_review'` or `'needs_info'`.
 * Flips:
 *   - request.status                  → 'rejected'
 *   - request.reviewerId              → admin's userId
 *   - request.reviewedAt              → NOW()
 *   - request.eligibleToReapplyAt     → NOW() + COOLDOWN_AFTER_REJECTION_DAYS
 *   - influencer_profiles.verification_status → 'unverified' (revert from 'pending')
 *
 * Audit-logs with `action = 'influencer_verification_rejected'`.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const adminId = (session.user as { id: string }).id

  const { id: requestId } = await params
  if (!requestId) {
    return NextResponse.json({ error: 'Missing request id' }, { status: 400 })
  }

  let body: { reviewNotes?: string } = {}
  try {
    body = await req.json()
  } catch {
    /* empty body — fail validation below */
  }
  const reviewNotes = (body.reviewNotes ?? '').trim().slice(0, 1000)
  if (reviewNotes.length === 0) {
    return NextResponse.json(
      { error: 'reviewNotes is required when rejecting — explain why for the user.' },
      { status: 400 },
    )
  }

  const [existing] = await db
    .select()
    .from(influencerVerificationRequests)
    .where(eq(influencerVerificationRequests.id, requestId))
    .limit(1)
  if (!existing) {
    return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
  }
  if (existing.status !== 'manual_review' && existing.status !== 'needs_info') {
    return NextResponse.json(
      {
        error: `Request is in status '${existing.status}' — only manual_review or needs_info can be rejected.`,
        code: 'INVALID_STATE',
      },
      { status: 409 },
    )
  }

  const now = new Date()
  const eligibleToReapplyAt = new Date(
    now.getTime() + VERIFICATION_THRESHOLDS.COOLDOWN_AFTER_REJECTION_DAYS * 86_400_000,
  )

  await db.transaction(async (tx) => {
    await tx
      .update(influencerVerificationRequests)
      .set({
        status: 'rejected',
        reviewerId: adminId,
        reviewedAt: now,
        reviewNotes,
        eligibleToReapplyAt,
        updatedAt: now,
      })
      .where(eq(influencerVerificationRequests.id, requestId))
    await tx
      .update(influencerProfiles)
      .set({ verificationStatus: 'unverified', updatedAt: now })
      .where(eq(influencerProfiles.userId, existing.userId))
  })

  await db
    .insert(auditLog)
    .values({
      userId: existing.userId,
      action: 'influencer_verification_rejected',
      dataType: 'user',
      accessedBy: adminId,
      metadata: {
        requestId,
        cooldownDays: VERIFICATION_THRESHOLDS.COOLDOWN_AFTER_REJECTION_DAYS,
      },
      reason: 'Admin rejected manual-review verification',
    })
    .catch((err) => console.error('[VerificationReject] Audit log failed:', err))

  return NextResponse.json({
    requestId,
    status: 'rejected',
    reviewedAt: now.toISOString(),
    eligibleToReapplyAt: eligibleToReapplyAt.toISOString(),
  })
}
