/**
 * Content Approval Repository
 *
 * DB queries for content review workflow: pending posts, SLA tracking,
 * reminder records. No business logic, no auth.
 */

import 'server-only'

import { db } from '@/db'
import {
  influencerContentPosts,
  influencerCampaigns,
  campaignInfluencers,
  contentReviewReminders,
  users,
  auditLog,
} from '@/db/schema'
import { eq, and, sql, isNull, isNotNull, lte, desc } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

export interface PendingPostRow {
  id: string
  title: string
  body: string | null
  mediaType: string
  mediaUrls: string[] | null
  thumbnailUrl: string | null
  influencerId: string
  influencerName: string | null
  campaignId: string | null
  campaignTitle: string | null
  brandId: string | null
  reviewSubmittedAt: Date | null
  resubmissionCount: number | null
  reviewSlaHours: number | null
  autoApproveEnabled: boolean | null
  createdAt: Date
}

// ── Read: Pending posts ─────────────────────────────────────────

/**
 * All pending_review posts for campaigns owned by this brand.
 */
export async function getPendingPostsForBrand(brandId: string): Promise<PendingPostRow[]> {
  const rows = await db
    .select({
      id: influencerContentPosts.id,
      title: influencerContentPosts.title,
      body: influencerContentPosts.body,
      mediaType: influencerContentPosts.mediaType,
      mediaUrls: influencerContentPosts.mediaUrls,
      thumbnailUrl: influencerContentPosts.thumbnailUrl,
      influencerId: influencerContentPosts.influencerId,
      influencerName: users.name,
      campaignId: influencerContentPosts.campaignId,
      campaignTitle: influencerCampaigns.title,
      brandId: influencerCampaigns.brandId,
      reviewSubmittedAt: influencerContentPosts.reviewSubmittedAt,
      resubmissionCount: influencerContentPosts.resubmissionCount,
      reviewSlaHours: influencerCampaigns.reviewSlaHours,
      autoApproveEnabled: influencerCampaigns.autoApproveEnabled,
      createdAt: influencerContentPosts.createdAt,
    })
    .from(influencerContentPosts)
    .innerJoin(
      influencerCampaigns,
      eq(influencerCampaigns.id, influencerContentPosts.campaignId),
    )
    .leftJoin(users, eq(users.id, influencerContentPosts.influencerId))
    .where(
      and(
        eq(influencerContentPosts.status, 'pending_review'),
        eq(influencerCampaigns.brandId, brandId),
      ),
    )
    .orderBy(influencerContentPosts.reviewSubmittedAt)

  return rows
}

/**
 * All pending_review posts that are NOT linked to a campaign (platform content).
 * For admin review.
 */
export async function getPendingPostsForAdmin(): Promise<PendingPostRow[]> {
  const rows = await db
    .select({
      id: influencerContentPosts.id,
      title: influencerContentPosts.title,
      body: influencerContentPosts.body,
      mediaType: influencerContentPosts.mediaType,
      mediaUrls: influencerContentPosts.mediaUrls,
      thumbnailUrl: influencerContentPosts.thumbnailUrl,
      influencerId: influencerContentPosts.influencerId,
      influencerName: users.name,
      campaignId: influencerContentPosts.campaignId,
      campaignTitle: sql<string | null>`NULL`,
      brandId: influencerContentPosts.brandId,
      reviewSubmittedAt: influencerContentPosts.reviewSubmittedAt,
      resubmissionCount: influencerContentPosts.resubmissionCount,
      reviewSlaHours: sql<number | null>`NULL`,
      autoApproveEnabled: sql<boolean | null>`NULL`,
      createdAt: influencerContentPosts.createdAt,
    })
    .from(influencerContentPosts)
    .leftJoin(users, eq(users.id, influencerContentPosts.influencerId))
    .where(
      and(
        eq(influencerContentPosts.status, 'pending_review'),
        isNull(influencerContentPosts.campaignId),
      ),
    )
    .orderBy(influencerContentPosts.reviewSubmittedAt)

  return rows
}

// ── Read: SLA tracking ──────────────────────────────────────────

/**
 * Posts approaching SLA threshold. Returns posts where:
 * - status = pending_review
 * - linked to a campaign with review_sla_hours set
 * - elapsed time >= thresholdPct% of SLA
 */
export async function getPostsApproachingSla(
  thresholdPct: number,
): Promise<PendingPostRow[]> {
  const rows = await db
    .select({
      id: influencerContentPosts.id,
      title: influencerContentPosts.title,
      body: influencerContentPosts.body,
      mediaType: influencerContentPosts.mediaType,
      mediaUrls: influencerContentPosts.mediaUrls,
      thumbnailUrl: influencerContentPosts.thumbnailUrl,
      influencerId: influencerContentPosts.influencerId,
      influencerName: users.name,
      campaignId: influencerContentPosts.campaignId,
      campaignTitle: influencerCampaigns.title,
      brandId: influencerCampaigns.brandId,
      reviewSubmittedAt: influencerContentPosts.reviewSubmittedAt,
      resubmissionCount: influencerContentPosts.resubmissionCount,
      reviewSlaHours: influencerCampaigns.reviewSlaHours,
      autoApproveEnabled: influencerCampaigns.autoApproveEnabled,
      createdAt: influencerContentPosts.createdAt,
    })
    .from(influencerContentPosts)
    .innerJoin(
      influencerCampaigns,
      eq(influencerCampaigns.id, influencerContentPosts.campaignId),
    )
    .leftJoin(users, eq(users.id, influencerContentPosts.influencerId))
    .where(
      and(
        eq(influencerContentPosts.status, 'pending_review'),
        isNotNull(influencerContentPosts.reviewSubmittedAt),
        isNotNull(influencerCampaigns.reviewSlaHours),
        // elapsed hours >= thresholdPct% of SLA
        sql`EXTRACT(EPOCH FROM (NOW() - ${influencerContentPosts.reviewSubmittedAt})) / 3600.0
            >= ${influencerCampaigns.reviewSlaHours} * ${thresholdPct / 100}`,
      ),
    )
    .orderBy(influencerContentPosts.reviewSubmittedAt)

  return rows
}

/**
 * Posts that have exceeded their SLA (100%+).
 */
export async function getPostsExceedingSla(): Promise<PendingPostRow[]> {
  return getPostsApproachingSla(100)
}

// ── Write: Review actions ───────────────────────────────────────

/**
 * Set post status to pending_review with timestamp.
 */
export async function markPostPendingReview(postId: string) {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({
      status: 'pending_review' as any,
      reviewSubmittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(influencerContentPosts.id, postId))
    .returning()
  return updated
}

/**
 * Approve a post: set status to published, record reviewer.
 */
export async function markPostApproved(postId: string, reviewedBy: string) {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({
      status: 'published' as any,
      reviewedAt: new Date(),
      reviewedBy,
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(influencerContentPosts.id, postId))
    .returning()
  return updated
}

/**
 * Reject a post: set status to rejected, record reason + reviewer.
 */
export async function markPostRejected(postId: string, reviewedBy: string, reason: string) {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({
      status: 'rejected' as any,
      reviewedAt: new Date(),
      reviewedBy,
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(influencerContentPosts.id, postId))
    .returning()
  return updated
}

/**
 * Resubmit a rejected post: reset to pending_review, increment counter.
 */
export async function markPostResubmitted(
  postId: string,
  updates: { title?: string; body?: string; mediaUrls?: string[] },
) {
  const [updated] = await db
    .update(influencerContentPosts)
    .set({
      ...updates,
      status: 'pending_review' as any,
      reviewSubmittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      resubmissionCount: sql`COALESCE(${influencerContentPosts.resubmissionCount}, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(influencerContentPosts.id, postId))
    .returning()
  return updated
}

// ── Reminder records ────────────────────────────────────────────

/**
 * Check if a reminder of this type already exists for this post.
 */
export async function hasReminder(
  postId: string,
  reminderType: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: contentReviewReminders.id })
    .from(contentReviewReminders)
    .where(
      and(
        eq(contentReviewReminders.postId, postId),
        eq(contentReviewReminders.reminderType, reminderType as any),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * Create a reminder record. Returns null if duplicate (unique constraint).
 */
export async function createReminderRecord(data: {
  postId: string
  campaignId: string
  brandId: string
  reminderType: '75_pct' | '90_pct' | 'sla_expired' | 'daily'
  scheduledAt: Date
}) {
  try {
    const [row] = await db
      .insert(contentReviewReminders)
      .values({
        postId: data.postId,
        campaignId: data.campaignId,
        brandId: data.brandId,
        reminderType: data.reminderType,
        scheduledAt: data.scheduledAt,
      })
      .returning()
    return row
  } catch (e: any) {
    // Unique constraint violation — reminder already exists
    if (e?.code === '23505') return null
    throw e
  }
}

/**
 * Mark a reminder as sent.
 */
export async function markReminderSent(reminderId: string) {
  await db
    .update(contentReviewReminders)
    .set({ sentAt: new Date() })
    .where(eq(contentReviewReminders.id, reminderId))
}

/**
 * Get unsent reminders scheduled before a given time.
 */
export async function getPendingReminders(before: Date) {
  return db
    .select()
    .from(contentReviewReminders)
    .where(
      and(
        isNull(contentReviewReminders.sentAt),
        lte(contentReviewReminders.scheduledAt, before),
      ),
    )
    .orderBy(contentReviewReminders.scheduledAt)
}

// ── Audit logging ───────────────────────────────────────────────

export async function logApprovalAction(data: {
  action: 'content_approved' | 'content_rejected' | 'content_auto_approved'
  postId: string
  actorId: string   // brandUserId or 'system'
  metadata?: Record<string, any>
}) {
  await db.insert(auditLog).values({
    userId: data.postId,
    action: data.action,
    dataType: 'content_post',
    accessedBy: data.actorId,
    metadata: data.metadata ?? {},
  })
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Verify a brand owns the campaign that a post belongs to.
 */
export async function isBrandCampaignOwner(
  brandId: string,
  campaignId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: influencerCampaigns.id })
    .from(influencerCampaigns)
    .where(
      and(
        eq(influencerCampaigns.id, campaignId),
        eq(influencerCampaigns.brandId, brandId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

/**
 * Get campaign details for a post (used by service layer).
 */
export async function getCampaignForPost(postId: string) {
  const rows = await db
    .select({
      campaignId: influencerCampaigns.id,
      campaignTitle: influencerCampaigns.title,
      brandId: influencerCampaigns.brandId,
      reviewSlaHours: influencerCampaigns.reviewSlaHours,
      autoApproveEnabled: influencerCampaigns.autoApproveEnabled,
    })
    .from(influencerContentPosts)
    .innerJoin(
      influencerCampaigns,
      eq(influencerCampaigns.id, influencerContentPosts.campaignId),
    )
    .where(eq(influencerContentPosts.id, postId))
    .limit(1)

  return rows[0] ?? null
}
