import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users, influencerVerificationRequests, auditLog } from '@/db/schema'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { sendNeedsInfoEmail } from '@/server/influencerVerificationEmailService'

/**
 * A9 — Admin requests additional info from the user.
 *
 * POST /api/admin/verification-requests/[id]/request-info
 *
 * Body:
 *   { reviewNotes: string }  // REQUIRED — message the user will see
 *
 * Allowed only when the request is in `'manual_review'`. Flips status
 * to `'needs_info'` — the user can re-submit without waiting for the
 * 30-day cooldown (since this isn't a rejection). The current request
 * row stays as the "open request" so the user-side request guard still
 * blocks a second submission until they replace this one.
 *
 * `influencer_profiles.verification_status` stays at `'pending'` — the
 * user is still in the queue, just waiting on their reply.
 *
 * Audit-logs with `action = 'influencer_verification_needs_info'`.
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
      { error: 'reviewNotes is required — explain what info you need from the user.' },
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
  if (existing.status !== 'manual_review') {
    return NextResponse.json(
      {
        error: `Request is in status '${existing.status}' — only manual_review can be moved to needs_info.`,
        code: 'INVALID_STATE',
      },
      { status: 409 },
    )
  }

  const now = new Date()
  await db
    .update(influencerVerificationRequests)
    .set({
      status: 'needs_info',
      reviewerId: adminId,
      reviewNotes,
      updatedAt: now,
      // NOTE: reviewedAt deliberately left null — this is NOT a final
      // decision; the next admin action (approve / reject) sets it.
    })
    .where(eq(influencerVerificationRequests.id, requestId))

  await db
    .insert(auditLog)
    .values({
      userId: existing.userId,
      action: 'influencer_verification_needs_info',
      dataType: 'user',
      accessedBy: adminId,
      metadata: { requestId },
      reason: 'Admin requested additional info from user',
    })
    .catch((err) => console.error('[VerificationNeedsInfo] Audit log failed:', err))

  const [userRow] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, existing.userId))
    .limit(1)
  if (userRow) {
    void sendNeedsInfoEmail({
      email: userRow.email,
      name: userRow.name,
      reviewerNotes: reviewNotes,
    }).catch((err) => console.error('[VerificationNeedsInfo] email failed:', err))
  }

  return NextResponse.json({
    requestId,
    status: 'needs_info',
  })
}
