import { NextResponse } from 'next/server'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'

import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { influencerProfiles, influencerVerificationRequests } from '@/db/schema'
import { evaluateVerificationRequest } from '@/server/verificationThresholdService'

/**
 * A9 — Influencer verification status.
 *
 * GET /api/influencer/verification/status
 *
 * Returns the influencer's current verification state in one round-trip:
 *
 *   - `profileStatus` — `'unverified' | 'pending' | 'verified'` from
 *                       `influencer_profiles.verification_status`. The
 *                       current state.
 *   - `openRequest`   — the most recent open request (status in
 *                       'pending' / 'manual_review' / 'needs_info'),
 *                       or null.
 *   - `lastDecision`  — the most recent CLOSED request (any decided
 *                       status), or null. Useful for showing the user
 *                       why they were rejected last time, or when their
 *                       cooldown ends.
 *   - `cooldownUntil` — `eligibleToReapplyAt` from `lastDecision` if
 *                       still in the future; null otherwise.
 *   - `livePreview`   — current evaluator output against the user's
 *                       LIVE profile state (re-run on every call so
 *                       the UI checklist updates as they edit). Includes
 *                       all 8 checks + tier + auto-decision. Cheap.
 *
 * No auth on the `/verify-email` page route — but THIS route needs an
 * authenticated session (otherwise we don't know whose status to read).
 * Returns 401 on missing session, 404 on missing influencer profile
 * (the user hasn't completed onboarding yet).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as { id: string }).id
  const role = (session.user as { role?: string }).role
  const isInfluencer = (session.user as { isInfluencer?: boolean }).isInfluencer === true

  if (role !== 'influencer' && !isInfluencer && role !== 'admin') {
    return NextResponse.json(
      { error: 'Only influencers can read verification status.' },
      { status: 403 },
    )
  }

  const [profile] = await db
    .select({ verificationStatus: influencerProfiles.verificationStatus })
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, userId))
    .limit(1)
  if (!profile) {
    return NextResponse.json(
      { error: 'Influencer profile not found — complete onboarding first.', code: 'NO_PROFILE' },
      { status: 404 },
    )
  }

  // Open request (if any)
  const [openRequest] = await db
    .select({
      id: influencerVerificationRequests.id,
      status: influencerVerificationRequests.status,
      createdAt: influencerVerificationRequests.createdAt,
      applicationMessage: influencerVerificationRequests.applicationMessage,
    })
    .from(influencerVerificationRequests)
    .where(
      and(
        eq(influencerVerificationRequests.userId, userId),
        inArray(influencerVerificationRequests.status, ['pending', 'manual_review', 'needs_info']),
      ),
    )
    .orderBy(desc(influencerVerificationRequests.createdAt))
    .limit(1)

  // Last decision (most recent row regardless of status)
  const [lastDecision] = await db
    .select({
      id: influencerVerificationRequests.id,
      status: influencerVerificationRequests.status,
      createdAt: influencerVerificationRequests.createdAt,
      reviewedAt: influencerVerificationRequests.reviewedAt,
      reviewNotes: influencerVerificationRequests.reviewNotes,
      eligibleToReapplyAt: influencerVerificationRequests.eligibleToReapplyAt,
      thresholdCheckResult: influencerVerificationRequests.thresholdCheckResult,
    })
    .from(influencerVerificationRequests)
    .where(eq(influencerVerificationRequests.userId, userId))
    .orderBy(desc(influencerVerificationRequests.createdAt))
    .limit(1)

  const now = new Date()
  const cooldownUntil =
    lastDecision?.eligibleToReapplyAt && lastDecision.eligibleToReapplyAt > now
      ? lastDecision.eligibleToReapplyAt.toISOString()
      : null

  // Live preview — re-evaluate against current profile state so the
  // checklist UI updates as the user edits. Catch evaluator errors so a
  // missing prerequisite (e.g. social stats row absent) doesn't sink
  // the status read.
  let livePreview: Awaited<ReturnType<typeof evaluateVerificationRequest>> | null = null
  try {
    livePreview = await evaluateVerificationRequest(userId)
  } catch (err) {
    console.warn('[VerificationStatus] livePreview evaluation skipped:', err)
  }

  return NextResponse.json({
    profileStatus: profile.verificationStatus,
    openRequest,
    lastDecision,
    cooldownUntil,
    livePreview,
  })
}
