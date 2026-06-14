import { NextRequest, NextResponse } from 'next/server'
import { and, eq, desc, gt, inArray } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { users, influencerProfiles, influencerVerificationRequests, auditLog } from '@/db/schema'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import {
  requireEmailVerified,
  EmailNotVerifiedError,
  emailNotVerifiedResponseBody,
} from '@/server/emailVerificationGuard'
import { evaluateVerificationRequest } from '@/server/verificationThresholdService'
import { VERIFICATION_THRESHOLDS } from '@/lib/config/verificationThresholds'
import {
  sendAutoApprovedEmail,
  sendUnderReviewEmail,
  sendAdminAlertEmail,
} from '@/server/influencerVerificationEmailService'

/**
 * A9 — Influencer verification request.
 *
 * POST /api/influencer/verification/request
 *
 * Auth: must be logged in, must be an influencer (role === 'influencer'
 *       OR users.is_influencer === true), must have a verified email.
 * CSRF: required (state-mutating POST).
 *
 * Body (all optional):
 *   {
 *     applicationMessage?:  string  // free-text up to 1000 chars
 *     brandContactNotes?:   string  // free-text referral context, up to 500 chars
 *     portfolioLinks?:      string[] // up to 5 URLs
 *     requestManualReview?: boolean // user explicitly wants manual (skips Tier 1)
 *   }
 *
 * Flow:
 *   1. Auth + role check + email verification (7th hard-blocked route!).
 *   2. Block if user is already verified.
 *   3. Block if user has an open request (pending / manual_review / needs_info)
 *      via the partial unique index — but we check first for a friendly 4xx.
 *   4. Block if user is in post-rejection cooldown (eligible_to_reapply_at).
 *   5. Run `evaluateVerificationRequest(userId)`.
 *   6. Persist a row with status:
 *        Tier 1 → 'auto_approved' + flip profile.verificationStatus = 'verified'
 *        Tier 2 → 'manual_review'
 *        Tier 3 → 'auto_rejected' + set eligibleToReapplyAt = NOW() + 30d
 *      OR if requestManualReview === true → force 'manual_review' even on Tier 1.
 *   7. Audit log; return the result + the evaluator's checks for UI display.
 *
 * Returns:
 *   200 with { requestId, status, tier, checks, failedChecks, reason }
 *   401 Unauthorized — not logged in
 *   403 EMAIL_NOT_VERIFIED — structured body, intercepted by global modal
 *   403 — not an influencer
 *   409 — already verified, or open request exists, or in cooldown
 *   500 — profile missing, evaluator threw, etc.
 */
export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id
  const role = (session.user as { role?: string }).role
  const isInfluencer = (session.user as { isInfluencer?: boolean }).isInfluencer === true

  // Role gate — must be a primary-role influencer OR dual-role
  // consumer-with-isInfluencer. Admins are not influencers and don't
  // self-verify; brands obviously not.
  if (role !== 'influencer' && !isInfluencer) {
    return NextResponse.json(
      { error: 'Only influencers can submit a verification request.' },
      { status: 403 },
    )
  }

  // ── 8th hard-blocked route (the original EV.1 deferred #7) ───────
  try {
    await requireEmailVerified(userId)
  } catch (err) {
    if (err instanceof EmailNotVerifiedError) {
      return NextResponse.json(emailNotVerifiedResponseBody(), { status: 403 })
    }
    throw err
  }

  // ── Parse + lightly validate body ────────────────────────────────
  let body: {
    applicationMessage?: string
    brandContactNotes?: string
    portfolioLinks?: string[]
    requestManualReview?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine — all fields optional
  }
  const applicationMessage = (body.applicationMessage ?? '').trim().slice(0, 1000) || null
  const brandContactNotes  = (body.brandContactNotes ?? '').trim().slice(0, 500)  || null
  const portfolioLinks     = Array.isArray(body.portfolioLinks)
    ? body.portfolioLinks
        .filter((u) => typeof u === 'string' && u.trim().length > 0)
        .slice(0, 5)
    : []
  const userRequestedManualReview = body.requestManualReview === true

  // ── Already-verified guard ───────────────────────────────────────
  const [profile] = await db
    .select({ verificationStatus: influencerProfiles.verificationStatus })
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, userId))
    .limit(1)
  if (profile?.verificationStatus === 'verified') {
    return NextResponse.json(
      { error: 'Your profile is already verified.', code: 'ALREADY_VERIFIED' },
      { status: 409 },
    )
  }

  // ── Open request guard (friendly check before partial-unique-index fires) ─
  const [openReq] = await db
    .select({ id: influencerVerificationRequests.id, status: influencerVerificationRequests.status })
    .from(influencerVerificationRequests)
    .where(
      and(
        eq(influencerVerificationRequests.userId, userId),
        inArray(influencerVerificationRequests.status, ['pending', 'manual_review', 'needs_info']),
      ),
    )
    .limit(1)
  if (openReq) {
    return NextResponse.json(
      {
        error: 'You already have an open verification request.',
        code: 'OPEN_REQUEST_EXISTS',
        requestId: openReq.id,
        status: openReq.status,
      },
      { status: 409 },
    )
  }

  // ── Cooldown guard (after rejection) ─────────────────────────────
  const now = new Date()
  const [lastClosed] = await db
    .select({
      eligibleToReapplyAt: influencerVerificationRequests.eligibleToReapplyAt,
    })
    .from(influencerVerificationRequests)
    .where(
      and(
        eq(influencerVerificationRequests.userId, userId),
        gt(influencerVerificationRequests.eligibleToReapplyAt, now),
      ),
    )
    .orderBy(desc(influencerVerificationRequests.createdAt))
    .limit(1)
  if (lastClosed?.eligibleToReapplyAt) {
    return NextResponse.json(
      {
        error: 'You are in the post-rejection cooldown period.',
        code: 'COOLDOWN_ACTIVE',
        eligibleToReapplyAt: lastClosed.eligibleToReapplyAt.toISOString(),
      },
      { status: 409 },
    )
  }

  // ── Evaluate ────────────────────────────────────────────────────
  let evaluation
  try {
    evaluation = await evaluateVerificationRequest(userId)
  } catch (err) {
    console.error('[VerificationRequest] Evaluation failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Evaluation failed' },
      { status: 500 },
    )
  }

  // ── Decide row status + side-effects ────────────────────────────
  // User-requested manual review overrides Tier 1 only (still rejects
  // on Tier 3 hard floor — no opting around the hard rules).
  const rowStatus: 'auto_approved' | 'auto_rejected' | 'manual_review' =
    evaluation.autoDecision === 'reject'
      ? 'auto_rejected'
      : userRequestedManualReview && evaluation.autoDecision === 'approve'
      ? 'manual_review'
      : evaluation.autoDecision === 'approve'
      ? 'auto_approved'
      : 'manual_review'

  const eligibleToReapplyAt =
    rowStatus === 'auto_rejected'
      ? new Date(now.getTime() + VERIFICATION_THRESHOLDS.COOLDOWN_AFTER_REJECTION_DAYS * 86_400_000)
      : null

  // ── Insert + (conditionally) flip profile verification_status ───
  const [inserted] = await db
    .insert(influencerVerificationRequests)
    .values({
      userId,
      status: rowStatus,
      applicationMessage,
      brandContactNotes,
      portfolioLinks,
      thresholdCheckResult: {
        tier: evaluation.tier,
        autoDecision: evaluation.autoDecision,
        checks: evaluation.checks,
        failedChecks: evaluation.failedChecks,
        totalFollowers: evaluation.totalFollowers,
        reason: evaluation.reason,
      },
      reviewedAt: rowStatus === 'auto_approved' || rowStatus === 'auto_rejected' ? now : null,
      eligibleToReapplyAt,
    })
    .returning({ id: influencerVerificationRequests.id })

  if (rowStatus === 'auto_approved') {
    await db
      .update(influencerProfiles)
      .set({ verificationStatus: 'verified', updatedAt: now })
      .where(eq(influencerProfiles.userId, userId))
  } else if (rowStatus === 'manual_review') {
    // Mirror current state on profile so the user-side UI can show
    // "under review" without joining the requests table.
    await db
      .update(influencerProfiles)
      .set({ verificationStatus: 'pending', updatedAt: now })
      .where(eq(influencerProfiles.userId, userId))
  }
  // auto_rejected leaves verification_status at 'unverified' (default).

  // ── Audit ───────────────────────────────────────────────────────
  await db
    .insert(auditLog)
    .values({
      userId,
      action: 'influencer_verification_requested',
      dataType: 'user',
      accessedBy: userId,
      metadata: {
        requestId: inserted.id,
        status: rowStatus,
        tier: evaluation.tier,
        totalFollowers: evaluation.totalFollowers,
        failedChecks: evaluation.failedChecks,
      },
      reason: evaluation.reason,
    })
    .catch((err) => console.error('[VerificationRequest] Audit log failed:', err))

  // ── Email notifications (fire-and-forget; never blocks the response) ─
  // Auto-rejected gets no email — the UI shows the failed checks inline,
  // and a "you've been rejected" email to someone we just told their
  // request failed for fixable reasons is noise.
  const [userRow] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (userRow && rowStatus === 'auto_approved') {
    void sendAutoApprovedEmail({ email: userRow.email, name: userRow.name }).catch((err) =>
      console.error('[VerificationRequest] auto_approved email failed:', err),
    )
  } else if (userRow && rowStatus === 'manual_review') {
    void sendUnderReviewEmail({ email: userRow.email, name: userRow.name }).catch((err) =>
      console.error('[VerificationRequest] under_review email failed:', err),
    )
    void sendAdminAlertEmail({
      influencerName: userRow.name || userRow.email,
      influencerEmail: userRow.email,
      totalFollowers: evaluation.totalFollowers,
      reason: evaluation.reason,
    }).catch((err) =>
      console.error('[VerificationRequest] admin_alert email failed:', err),
    )
  }

  return NextResponse.json({
    requestId: inserted.id,
    status: rowStatus,
    tier: evaluation.tier,
    checks: evaluation.checks,
    failedChecks: evaluation.failedChecks,
    reason: evaluation.reason,
    eligibleToReapplyAt: eligibleToReapplyAt?.toISOString() ?? null,
  })
}
