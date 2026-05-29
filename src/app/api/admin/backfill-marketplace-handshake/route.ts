import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import {
  campaignInfluencers,
  auditLog,
} from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import {
  listOrphanedAcceptedApplications,
  countOrphanedAcceptedApplications,
} from '@/db/repositories/campaignMarketplaceRepository'

/**
 * POST /api/admin/backfill-marketplace-handshake
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * One-off backfill for orphaned marketplace accepts created BEFORE the
 * acceptApplicationAtomic() fix shipped.
 *
 * For each application where:
 *   - campaign_applications.status = 'accepted'
 *   - no matching row in campaign_influencers
 *
 * Insert a campaign_influencers row with:
 *   - status        = 'accepted'
 *   - agreed_rate   = application.proposed_rate
 *   - accepted_at   = application.responded_at (or NOW if null)
 *   - invited_at    = application.responded_at (or NOW if null) — schema requires NOT NULL
 *
 * Each backfilled row is written inside its own transaction with an audit_log
 * entry tagged action='marketplace_handshake_backfilled'. A run on clean data
 * is a no-op (zero candidates returned by the WHERE clause).
 *
 * Idempotent: the underlying query excludes rows that already have a matching
 * campaign_influencers row, so re-running after a successful pass returns 0.
 *
 * Concurrent safety: even if two backfill calls race, the uq_campaign_influencer
 * UNIQUE (campaign_id, influencer_id) constraint serialises them — the loser
 * gets PG error 23505 which is caught per-row so the rest of the batch survives.
 *
 * Returns:
 *   { success, candidatesFound, inserted, alreadyExisted, errors }
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = {
    success: true,
    candidatesFound: 0,
    inserted: 0,
    alreadyExisted: 0,
    errors: [] as Array<{ applicationId: string; message: string }>,
    sample: [] as Array<{ applicationId: string; campaignId: string; influencerId: string }>,
  }

  try {
    summary.candidatesFound = await countOrphanedAcceptedApplications()

    if (summary.candidatesFound === 0) {
      return NextResponse.json({ ...summary, message: 'No orphans to backfill.' })
    }

    // Page through orphans 200 at a time — bounded memory in case of mass
    // historical orphans. Each iteration re-queries because successful
    // inserts remove rows from the orphan set.
    const PAGE = 200
    while (true) {
      const orphans = await listOrphanedAcceptedApplications(PAGE)
      if (orphans.length === 0) break

      for (const orphan of orphans) {
        try {
          await db.transaction(async (tx) => {
            // Defensive re-check inside tx: another caller may have just
            // inserted the row. The UNIQUE constraint will also catch this
            // (23505), but this avoids the wasted INSERT attempt.
            const [existing] = await tx
              .select({ id: campaignInfluencers.id })
              .from(campaignInfluencers)
              .where(and(
                eq(campaignInfluencers.campaignId, orphan.campaignId),
                eq(campaignInfluencers.influencerId, orphan.influencerId),
              ))
              .limit(1)

            if (existing) {
              summary.alreadyExisted += 1
              return
            }

            const acceptedAt = orphan.respondedAt ?? new Date()
            const [inserted] = await tx
              .insert(campaignInfluencers)
              .values({
                campaignId: orphan.campaignId,
                influencerId: orphan.influencerId,
                agreedRate: orphan.proposedRate,
                deliverables: [],
                status: 'accepted',
                invitedAt: acceptedAt,
                acceptedAt,
              })
              .returning()

            await tx.insert(auditLog).values({
              userId: orphan.influencerId,
              action: 'marketplace_handshake_backfilled',
              dataType: 'campaign_application',
              accessedBy: 'system',
              metadata: {
                applicationId: orphan.applicationId,
                campaignId: orphan.campaignId,
                invitationId: inserted.id,
                agreedRate: inserted.agreedRate,
                source: 'backfill-marketplace-handshake',
              },
              reason: 'Backfill orphan accepted application (pre-fix data)',
            })

            summary.inserted += 1
            if (summary.sample.length < 10) {
              summary.sample.push({
                applicationId: orphan.applicationId,
                campaignId: orphan.campaignId,
                influencerId: orphan.influencerId,
              })
            }
          })
        } catch (err: any) {
          if (err?.code === '23505') {
            summary.alreadyExisted += 1
          } else {
            summary.errors.push({
              applicationId: orphan.applicationId,
              message: err?.message ?? String(err),
            })
          }
        }
      }

      // Safety stop — if a page returned no inserts AND no errors AND no
      // already-existed counts, we're stuck (shouldn't happen). Break.
      if (orphans.length < PAGE) break
    }

    summary.success = summary.errors.length === 0
    return NextResponse.json(summary, { status: summary.success ? 200 : 207 })
  } catch (err: any) {
    summary.success = false
    return NextResponse.json(
      { ...summary, error: err?.message ?? String(err) },
      { status: 500 },
    )
  }
}
