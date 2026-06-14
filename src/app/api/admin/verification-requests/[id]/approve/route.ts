import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users, influencerProfiles, influencerVerificationRequests, auditLog } from '@/db/schema'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { sendManualApprovedEmail } from '@/server/influencerVerificationEmailService'

/**
 * A9 — Admin approve a manual_review verification request.
 *
 * POST /api/admin/verification-requests/[id]/approve
 *
 * Body (optional):  { reviewNotes?: string }
 *
 * Allowed only when the request is currently in `'manual_review'` or
 * `'needs_info'`. Flips:
 *   - request.status                            → 'approved'
 *   - request.reviewerId                         → admin's userId
 *   - request.reviewedAt                         → NOW()
 *   - influencer_profiles.verification_status   → 'verified'
 *
 * Returns the updated request. Audit-logs with `action =
 * 'influencer_verification_approved'`.
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
    /* empty body fine */
  }
  const reviewNotes = (body.reviewNotes ?? '').trim().slice(0, 1000) || null

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
        error: `Request is in status '${existing.status}' — only manual_review or needs_info can be approved.`,
        code: 'INVALID_STATE',
      },
      { status: 409 },
    )
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(influencerVerificationRequests)
      .set({
        status: 'approved',
        reviewerId: adminId,
        reviewedAt: now,
        reviewNotes,
        updatedAt: now,
      })
      .where(eq(influencerVerificationRequests.id, requestId))
    await tx
      .update(influencerProfiles)
      .set({ verificationStatus: 'verified', updatedAt: now })
      .where(eq(influencerProfiles.userId, existing.userId))
  })

  await db
    .insert(auditLog)
    .values({
      userId: existing.userId,
      action: 'influencer_verification_approved',
      dataType: 'user',
      accessedBy: adminId,
      metadata: { requestId, reviewNotes: reviewNotes ? '[provided]' : null },
      reason: 'Admin approved manual-review verification',
    })
    .catch((err) => console.error('[VerificationApprove] Audit log failed:', err))

  // Email user (fire-and-forget; admin route never blocks on email outage).
  const [userRow] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, existing.userId))
    .limit(1)
  if (userRow) {
    void sendManualApprovedEmail({
      email: userRow.email,
      name: userRow.name,
      reviewerNotes: reviewNotes,
    }).catch((err) => console.error('[VerificationApprove] email failed:', err))
  }

  return NextResponse.json({
    requestId,
    status: 'approved',
    reviewedAt: now.toISOString(),
  })
}
