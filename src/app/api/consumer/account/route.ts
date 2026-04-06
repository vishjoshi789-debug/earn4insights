/**
 * Consumer Account Erasure API
 *
 * DELETE /api/consumer/account
 *   GDPR Art. 17 / DPDP §14 — Right to Erasure.
 *
 *   What happens immediately:
 *   1. All signal snapshots are permanently deleted (no retention reason under GDPR Art. 6).
 *   2. All sensitive attributes are soft-deleted (scheduled for physical deletion after 30 days).
 *   3. The user profile is flagged for deletion via the existing grace-period mechanism:
 *      consent.deletionRequested = true, consent.deletionScheduledFor = now + 30 days.
 *      The existing /api/jobs/process-deletions cron picks this up and hard-deletes
 *      the user record after the grace period expires.
 *
 *   The 30-day grace period allows the user to cancel accidental deletion requests.
 *   Users who reconnect within 30 days can cancel by contacting support (DSAR flow).
 *
 * Access: consumer role only. Users can only delete their own account.
 */

import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { softDeleteAllSensitiveAttributesForUser } from '@/db/repositories/sensitiveAttributeRepository'
import { deleteAllSnapshotsForUser } from '@/db/repositories/signalRepository'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

const GRACE_PERIOD_DAYS = 30

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (role !== 'consumer') {
      return NextResponse.json(
        { error: 'Only consumer accounts can be self-deleted via this endpoint.' },
        { status: 403 }
      )
    }

    // Optional confirmation body — require explicit consent to avoid accidental deletion
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== true) {
      return NextResponse.json(
        {
          error: 'Missing confirmation. Send { "confirm": true } to proceed with account deletion.',
          gracePeriodDays: GRACE_PERIOD_DAYS,
        },
        { status: 400 }
      )
    }

    const scheduledDeletionAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    )

    // Step 1: Permanently delete signal snapshots immediately.
    // Signal data has no mandatory retention period under GDPR Art. 6/17.
    const deletedSnapshots = await deleteAllSnapshotsForUser(userId)

    // Step 2: Soft-delete all sensitive attributes.
    // Physical deletion happens 30 days later via the physical-delete-sensitive-attributes cron.
    const softDeletedAttributes = await softDeleteAllSensitiveAttributesForUser(userId)

    // Step 3: Flag the user profile for deletion via the existing grace-period mechanism.
    // The /api/jobs/process-deletions cron reads consent->>'deletionRequested'
    // and hard-deletes the record when the grace period expires.
    await db
      .update(userProfiles)
      .set({
        consent: sql`jsonb_set(
          jsonb_set(
            COALESCE(${userProfiles.consent}, '{}'::jsonb),
            '{deletionRequested}',
            'true'::jsonb
          ),
          '{deletionScheduledFor}',
          to_jsonb(${scheduledDeletionAt.toISOString()}::text)
        )`,
      })
      .where(eq(userProfiles.userId, userId))

    return NextResponse.json({
      success: true,
      message: 'Your account has been scheduled for deletion.',
      scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      gracePeriodDays: GRACE_PERIOD_DAYS,
      deletedSnapshots,
      softDeletedSensitiveAttributes: softDeletedAttributes,
      note: 'Signal data was deleted immediately. Sensitive attributes and account data will be permanently removed after the grace period.',
    })
  } catch (error) {
    console.error('[Consumer Account DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
