import 'server-only'

import { db } from '@/db'
import {
  influencerCampaigns,
  campaignApplications,
  campaignInfluencers,
  influencerReviews,
  influencerProfiles,
  users,
  icpMatchScores,
  auditLog,
  type NewCampaignApplication,
  type CampaignApplication,
  type CampaignInfluencer,
} from '@/db/schema'
import {
  eq, and, or, desc, asc, sql, count, avg, gte, lte, ne, inArray, isNull,
} from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────

export interface MarketplaceFilters {
  category?: string
  minBudget?: number
  maxBudget?: number
  platform?: string
  niche?: string
  geography?: string
  deadlineBefore?: string
  minBrandRating?: number
  sortBy?: 'newest' | 'budget_high' | 'budget_low' | 'deadline_soon'
  page?: number
  pageSize?: number
}

export interface MarketplaceCampaign {
  id: string
  brandId: string
  brandName: string | null
  title: string
  brief: string | null
  deliverables: string[]
  targetPlatforms: string[]
  targetGeography: string[]
  budgetTotal: number
  budgetCurrency: string
  status: string
  startDate: string | null
  endDate: string | null
  applicationDeadline: string | null
  maxInfluencers: number | null
  icpId: string | null
  applicationCount: number
  avgBrandRating: number | null
  createdAt: Date
}

// ── Shared subqueries ────────────────────────────────────────────

function appCountSubquery(alias: string) {
  return db
    .select({
      campaignId: campaignApplications.campaignId,
      cnt: count().as('cnt'),
    })
    .from(campaignApplications)
    .where(ne(campaignApplications.status, 'withdrawn'))
    .groupBy(campaignApplications.campaignId)
    .as(alias)
}

function brandRatingSubquery(alias: string) {
  return db
    .select({
      campaignId: influencerReviews.campaignId,
      avgRating: avg(influencerReviews.rating).as('avg_rating'),
    })
    .from(influencerReviews)
    .groupBy(influencerReviews.campaignId)
    .as(alias)
}

function campaignSelect(appSq: any, ratingSq: any) {
  return {
    id: influencerCampaigns.id,
    brandId: influencerCampaigns.brandId,
    brandName: users.name,
    title: influencerCampaigns.title,
    brief: influencerCampaigns.brief,
    deliverables: influencerCampaigns.deliverables,
    targetPlatforms: influencerCampaigns.targetPlatforms,
    targetGeography: influencerCampaigns.targetGeography,
    budgetTotal: influencerCampaigns.budgetTotal,
    budgetCurrency: influencerCampaigns.budgetCurrency,
    status: influencerCampaigns.status,
    startDate: influencerCampaigns.startDate,
    endDate: influencerCampaigns.endDate,
    applicationDeadline: influencerCampaigns.applicationDeadline,
    maxInfluencers: influencerCampaigns.maxInfluencers,
    icpId: influencerCampaigns.icpId,
    applicationCount: sql<number>`COALESCE(${appSq.cnt}, 0)`.as('application_count'),
    avgBrandRating: sql<number | null>`${ratingSq.avgRating}`.as('avg_brand_rating'),
    createdAt: influencerCampaigns.createdAt,
  }
}

function normalizeRow(r: any): MarketplaceCampaign {
  return {
    ...r,
    deliverables: r.deliverables ?? [],
    targetPlatforms: r.targetPlatforms ?? [],
    targetGeography: r.targetGeography ?? [],
    applicationCount: Number(r.applicationCount),
    avgBrandRating: r.avgBrandRating ? Number(r.avgBrandRating) : null,
  }
}

// ── Public campaign listing ──────────────────────────────────────

export async function getPublicCampaigns(
  filters: MarketplaceFilters
): Promise<{ campaigns: MarketplaceCampaign[]; total: number }> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 12
  const offset = (page - 1) * pageSize

  const conditions: any[] = [
    eq(influencerCampaigns.isPublic, true),
    // A13 — drafts are still being edited; do not surface them in the
    // marketplace even if the brand has flipped isPublic on early.
    or(
      eq(influencerCampaigns.status, 'proposed'),
      eq(influencerCampaigns.status, 'active'),
    ),
  ]

  if (filters.minBudget) conditions.push(gte(influencerCampaigns.budgetTotal, filters.minBudget))
  if (filters.maxBudget) conditions.push(lte(influencerCampaigns.budgetTotal, filters.maxBudget))
  if (filters.platform) conditions.push(sql`${filters.platform} = ANY(${influencerCampaigns.targetPlatforms})`)
  if (filters.geography) conditions.push(sql`${filters.geography} = ANY(${influencerCampaigns.targetGeography})`)
  if (filters.deadlineBefore) conditions.push(lte(influencerCampaigns.applicationDeadline, filters.deadlineBefore))

  const whereClause = and(...conditions)

  const [{ total }] = await db
    .select({ total: count() })
    .from(influencerCampaigns)
    .where(whereClause)

  let orderBy: any
  switch (filters.sortBy) {
    case 'budget_high': orderBy = desc(influencerCampaigns.budgetTotal); break
    case 'budget_low': orderBy = asc(influencerCampaigns.budgetTotal); break
    case 'deadline_soon': orderBy = asc(influencerCampaigns.applicationDeadline); break
    default: orderBy = desc(influencerCampaigns.createdAt)
  }

  const appSq = appCountSubquery('ac1')
  const ratingSq = brandRatingSubquery('br1')

  const rows = await db
    .select(campaignSelect(appSq, ratingSq))
    .from(influencerCampaigns)
    .leftJoin(users, eq(influencerCampaigns.brandId, users.id))
    .leftJoin(appSq, eq(influencerCampaigns.id, appSq.campaignId))
    .leftJoin(ratingSq, eq(influencerCampaigns.id, ratingSq.campaignId))
    .where(whereClause)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset)

  return { campaigns: rows.map(normalizeRow), total }
}

// ── Recommended campaigns ───────────────────────────────────────

export async function getRecommendedCampaigns(
  influencerId: string,
  limit = 6
): Promise<MarketplaceCampaign[]> {
  const [profile] = await db
    .select({ niche: influencerProfiles.niche })
    .from(influencerProfiles)
    .where(eq(influencerProfiles.userId, influencerId))
    .limit(1)

  if (!profile?.niche || profile.niche.length === 0) return []
  const nicheParts = profile.niche.map(n => n.toLowerCase())

  const [appliedRows, invitedRows] = await Promise.all([
    db.select({ cid: campaignApplications.campaignId }).from(campaignApplications)
      .where(eq(campaignApplications.influencerId, influencerId)),
    db.select({ cid: campaignInfluencers.campaignId }).from(campaignInfluencers)
      .where(eq(campaignInfluencers.influencerId, influencerId)),
  ])
  const excludeIds = [...appliedRows, ...invitedRows].map(r => r.cid)

  const conditions: any[] = [
    eq(influencerCampaigns.isPublic, true),
    // A13 — exclude drafts from recommended just like the listing.
    or(
      eq(influencerCampaigns.status, 'proposed'),
      eq(influencerCampaigns.status, 'active'),
    ),
  ]
  if (excludeIds.length > 0) {
    conditions.push(sql`${influencerCampaigns.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`)
  }

  const appSq = appCountSubquery('ac2')
  const ratingSq = brandRatingSubquery('br2')

  const rows = await db
    .select(campaignSelect(appSq, ratingSq))
    .from(influencerCampaigns)
    .leftJoin(users, eq(influencerCampaigns.brandId, users.id))
    .leftJoin(appSq, eq(influencerCampaigns.id, appSq.campaignId))
    .leftJoin(ratingSq, eq(influencerCampaigns.id, ratingSq.campaignId))
    .where(and(...conditions))
    .orderBy(desc(influencerCampaigns.createdAt))
    .limit(limit * 3)

  const matched = rows.filter(r => {
    const texts = [...(r.deliverables ?? []), ...(r.targetPlatforms ?? []), r.brief ?? '', r.title ?? '']
      .map(s => s.toLowerCase())
    return nicheParts.some(np => texts.some(t => t.includes(np) || np.includes(t)))
  })

  return matched.slice(0, limit).map(normalizeRow)
}

// ── Campaign detail for marketplace ─────────────────────────────

export async function getCampaignMarketplaceDetail(campaignId: string, influencerId: string) {
  const appSq = appCountSubquery('ac3')
  const ratingSq = brandRatingSubquery('br3')

  const [row] = await db
    .select({
      ...campaignSelect(appSq, ratingSq),
      requirements: influencerCampaigns.requirements,
      paymentType: influencerCampaigns.paymentType,
    })
    .from(influencerCampaigns)
    .leftJoin(users, eq(influencerCampaigns.brandId, users.id))
    .leftJoin(appSq, eq(influencerCampaigns.id, appSq.campaignId))
    .leftJoin(ratingSq, eq(influencerCampaigns.id, ratingSq.campaignId))
    .where(and(
      eq(influencerCampaigns.id, campaignId),
      eq(influencerCampaigns.isPublic, true),
      // A13 — same draft-exclusion as the listing. A direct URL to a
      // draft marketplace detail should 404 rather than render a
      // half-edited campaign.
      or(
        eq(influencerCampaigns.status, 'proposed'),
        eq(influencerCampaigns.status, 'active'),
      ),
    ))
    .limit(1)

  if (!row) return { campaign: null, application: null, isInvited: false }

  const [[existingApp], [invitation]] = await Promise.all([
    db.select().from(campaignApplications)
      .where(and(eq(campaignApplications.campaignId, campaignId), eq(campaignApplications.influencerId, influencerId)))
      .limit(1),
    db.select({ id: campaignInfluencers.id }).from(campaignInfluencers)
      .where(and(eq(campaignInfluencers.campaignId, campaignId), eq(campaignInfluencers.influencerId, influencerId)))
      .limit(1),
  ])

  return {
    campaign: { ...normalizeRow(row), requirements: row.requirements, paymentType: row.paymentType },
    application: existingApp ?? null,
    isInvited: !!invitation,
  }
}

// ── Create application ──────────────────────────────────────────

export async function createApplication(
  data: Omit<NewCampaignApplication, 'id' | 'appliedAt' | 'respondedAt' | 'status' | 'brandResponse'>
) {
  const [row] = await db.insert(campaignApplications).values(data).returning()
  return row
}

// ── Applications for influencer ─────────────────────────────────

export async function getApplicationsForInfluencer(influencerId: string, statusFilter?: string) {
  const conditions: any[] = [eq(campaignApplications.influencerId, influencerId)]
  if (statusFilter) conditions.push(eq(campaignApplications.status, statusFilter as any))

  const rows = await db
    .select({
      application: campaignApplications,
      campaignTitle: influencerCampaigns.title,
      brandName: users.name,
      budgetTotal: influencerCampaigns.budgetTotal,
      budgetCurrency: influencerCampaigns.budgetCurrency,
    })
    .from(campaignApplications)
    .innerJoin(influencerCampaigns, eq(campaignApplications.campaignId, influencerCampaigns.id))
    .leftJoin(users, eq(influencerCampaigns.brandId, users.id))
    .where(and(...conditions))
    .orderBy(desc(campaignApplications.appliedAt))

  return rows.map(r => ({
    ...r.application,
    campaignTitle: r.campaignTitle,
    brandName: r.brandName,
    budgetTotal: r.budgetTotal,
    budgetCurrency: r.budgetCurrency,
  }))
}

// ── Applications for campaign (brand) ───────────────────────────

export async function getApplicationsForCampaign(campaignId: string, brandId: string) {
  const [campaign] = await db.select({ brandId: influencerCampaigns.brandId }).from(influencerCampaigns)
    .where(eq(influencerCampaigns.id, campaignId)).limit(1)

  if (!campaign || campaign.brandId !== brandId) return { applications: [], isBrandOwner: false }

  const rows = await db
    .select({
      application: campaignApplications,
      influencerName: users.name,
      niche: influencerProfiles.niche,
      displayName: influencerProfiles.displayName,
    })
    .from(campaignApplications)
    .innerJoin(users, eq(campaignApplications.influencerId, users.id))
    .leftJoin(influencerProfiles, eq(campaignApplications.influencerId, influencerProfiles.userId))
    .where(eq(campaignApplications.campaignId, campaignId))
    .orderBy(desc(campaignApplications.appliedAt))

  return {
    applications: rows.map(r => ({
      ...r.application,
      influencerName: r.influencerName,
      niche: r.niche,
      displayName: r.displayName,
    })),
    isBrandOwner: true,
  }
}

// ── Update application status (brand) ───────────────────────────
//
// Used for the REJECTED path only. The ACCEPT path goes through
// acceptApplicationAtomic() below, which performs the application
// flip + campaign_influencers insert/bump in a single transaction.
//
// Kept as a separate function (not folded into the atomic helper)
// because rejection is a single-row write — wrapping it in a tx
// would be pure overhead.

export async function updateApplicationStatus(
  applicationId: string,
  status: 'rejected' | 'reviewing',
  brandResponse: string | null,
  brandId: string
) {
  const [app] = await db
    .select({ application: campaignApplications, campaignBrandId: influencerCampaigns.brandId })
    .from(campaignApplications)
    .innerJoin(influencerCampaigns, eq(campaignApplications.campaignId, influencerCampaigns.id))
    .where(eq(campaignApplications.id, applicationId))
    .limit(1)

  if (!app) return { application: null, error: 'Application not found' }
  if (app.campaignBrandId !== brandId) return { application: null, error: 'Not your campaign' }

  const [updated] = await db
    .update(campaignApplications)
    .set({ status, brandResponse, respondedAt: new Date() })
    .where(eq(campaignApplications.id, applicationId))
    .returning()

  return { application: updated }
}

// ── Accept application (atomic: status flip + campaign_influencers) ─

/**
 * The conflict path taken when reconciling the campaign_influencers row.
 * Recorded in the audit log so payment / dispute investigations can trace
 * exactly how the influencer arrived at status='accepted' on this campaign.
 */
export type AcceptConflictResolution =
  | 'inserted'              // No prior invitation/membership row — fresh insert.
  | 'bumped_from_invited'   // Brand had manually invited; flip 'invited' → 'accepted'.
  | 'bumped_from_rejected'  // Influencer had declined a prior invite; brand re-accepts.
  | 'preserved_active'      // Already 'accepted' / 'active' / 'completed' — left untouched.
  | 'idempotent_replay'     // Application was already 'accepted' and matching invitation found — full no-op.

export interface AcceptApplicationResult {
  application: CampaignApplication
  invitation: CampaignInfluencer
  conflictResolution: AcceptConflictResolution
  alreadyAccepted: boolean // True when the call was a replay of an earlier successful accept.
}

/**
 * Atomically accept a marketplace application:
 *   1. Flip campaign_applications.status to 'accepted' (idempotent — replays return the prior result).
 *   2. Insert OR reconcile the matching campaign_influencers row so downstream code
 *      (getInvitation, payment release, dispute, reviews, influencer "My Campaigns")
 *      finds the relationship.
 *   3. Write an audit_log row with the conflict-resolution path taken.
 *
 * The application row is locked FOR UPDATE so two concurrent accepts on the same
 * application serialise — the second sees status='accepted' and returns the prior
 * invitation row (idempotent_replay).
 *
 * Throws:
 *   - 'Application not found'        — bad applicationId
 *   - 'Not your campaign'            — brand doesn't own the campaign
 *   - 'Influencer withdrew this application' — influencer pulled the application
 */
export async function acceptApplicationAtomic(
  applicationId: string,
  brandResponse: string | null,
  brandId: string
): Promise<AcceptApplicationResult> {
  return db.transaction(async (tx) => {
    // ── 1. Lock the application row and load with the campaign owner ───
    // SELECT ... FOR UPDATE OF campaign_applications — serialises any
    // concurrent accept on the same application. The campaign join is read-only.
    const [appRow] = await tx
      .select({
        application: campaignApplications,
        campaignBrandId: influencerCampaigns.brandId,
      })
      .from(campaignApplications)
      .innerJoin(influencerCampaigns, eq(campaignApplications.campaignId, influencerCampaigns.id))
      .where(eq(campaignApplications.id, applicationId))
      .for('update', { of: campaignApplications })
      .limit(1)

    if (!appRow) throw new Error('Application not found')
    if (appRow.campaignBrandId !== brandId) throw new Error('Not your campaign')

    const app = appRow.application

    // ── 2. Withdrawn applications cannot be accepted ───────────────────
    // The influencer rescinded their interest; pretending to accept it
    // would mark them as a campaign member they explicitly opted out of.
    if (app.status === 'withdrawn') {
      throw new Error('Influencer withdrew this application')
    }

    // ── 3. Idempotent replay — application already accepted ────────────
    // If the matching invitation row exists, return both unchanged. If it
    // doesn't (legacy orphan from pre-fix data), fall through to the
    // insert path below to self-heal — the application row is already
    // correct, so step 4 will skip the application UPDATE.
    let alreadyAccepted = false
    if (app.status === 'accepted') {
      alreadyAccepted = true
      const [existing] = await tx
        .select()
        .from(campaignInfluencers)
        .where(and(
          eq(campaignInfluencers.campaignId, app.campaignId),
          eq(campaignInfluencers.influencerId, app.influencerId),
        ))
        .limit(1)
      if (existing) {
        return {
          application: app,
          invitation: existing,
          conflictResolution: 'idempotent_replay',
          alreadyAccepted: true,
        }
      }
      // Orphan — fall through to reconcile.
    }

    // ── 4. Flip the application to 'accepted' (skip if already there) ──
    let updatedApp: CampaignApplication = app
    if (!alreadyAccepted) {
      const [u] = await tx
        .update(campaignApplications)
        .set({ status: 'accepted', brandResponse, respondedAt: new Date() })
        .where(eq(campaignApplications.id, applicationId))
        .returning()
      updatedApp = u
    }

    // ── 5. Reconcile campaign_influencers ──────────────────────────────
    const [existingInvitation] = await tx
      .select()
      .from(campaignInfluencers)
      .where(and(
        eq(campaignInfluencers.campaignId, app.campaignId),
        eq(campaignInfluencers.influencerId, app.influencerId),
      ))
      .limit(1)

    let invitation: CampaignInfluencer
    let conflictResolution: AcceptConflictResolution

    if (!existingInvitation) {
      // No prior membership row — insert fresh.
      // agreed_rate seeded from the application's proposed_rate (the rate
      // the influencer offered; brand accepting = brand agrees to that rate).
      const [inserted] = await tx
        .insert(campaignInfluencers)
        .values({
          campaignId: app.campaignId,
          influencerId: app.influencerId,
          agreedRate: app.proposedRate,
          deliverables: [],
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .returning()
      invitation = inserted
      conflictResolution = 'inserted'
    } else if (existingInvitation.status === 'invited') {
      // Brand had previously manually invited; influencer ALSO applied.
      // Bump 'invited' → 'accepted'. Seed agreed_rate from the application
      // ONLY IF the manual invite didn't already set one — preserves any
      // negotiated rate from the manual flow.
      const [bumped] = await tx
        .update(campaignInfluencers)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          agreedRate: existingInvitation.agreedRate ?? app.proposedRate,
          updatedAt: new Date(),
        })
        .where(eq(campaignInfluencers.id, existingInvitation.id))
        .returning()
      invitation = bumped
      conflictResolution = 'bumped_from_invited'
    } else if (existingInvitation.status === 'rejected') {
      // Influencer had declined an earlier invite. Brand changed their mind
      // and is accepting the influencer's later marketplace application.
      const [bumped] = await tx
        .update(campaignInfluencers)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          agreedRate: app.proposedRate,
          updatedAt: new Date(),
        })
        .where(eq(campaignInfluencers.id, existingInvitation.id))
        .returning()
      invitation = bumped
      conflictResolution = 'bumped_from_rejected'
    } else {
      // 'accepted' | 'active' | 'completed' — already a member; leave alone.
      // Application is still flipped to 'accepted' for record-keeping; the
      // brand explicitly clicked accept and we should honour the application
      // status change even when the membership relationship already exists.
      invitation = existingInvitation
      conflictResolution = 'preserved_active'
    }

    // ── 6. Audit log ───────────────────────────────────────────────────
    // userId = influencer (the subject whose membership changed)
    // accessedBy = brand (the actor)
    // Lets us answer "how did this influencer end up on this campaign"
    // when investigating a payment or dispute later.
    await tx.insert(auditLog).values({
      userId: app.influencerId,
      action: 'marketplace_application_accepted',
      dataType: 'campaign_application',
      accessedBy: brandId,
      metadata: {
        applicationId: app.id,
        campaignId: app.campaignId,
        invitationId: invitation.id,
        agreedRate: invitation.agreedRate,
        proposedRate: app.proposedRate,
        conflictResolution,
        wasReplay: alreadyAccepted,
      },
      reason: alreadyAccepted
        ? 'Brand re-confirmed an already-accepted application'
        : 'Brand accepted influencer marketplace application',
    })

    return {
      application: updatedApp,
      invitation,
      conflictResolution,
      alreadyAccepted,
    }
  })
}

// ── Diagnostic / backfill helpers ───────────────────────────────

/**
 * Count campaign_applications rows where status='accepted' but no matching
 * campaign_influencers row exists. These are orphans created by the old
 * updateApplicationStatus-only accept path that this PR replaces.
 *
 * Used by the diagnostic + backfill admin routes. Pure read, no writes.
 */
export async function countOrphanedAcceptedApplications(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(campaignApplications)
    .leftJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, campaignApplications.campaignId),
        eq(campaignInfluencers.influencerId, campaignApplications.influencerId),
      ),
    )
    .where(and(
      eq(campaignApplications.status, 'accepted'),
      isNull(campaignInfluencers.id),
    ))
  return Number(row?.n ?? 0)
}

/**
 * Return up to `limit` orphaned accepted applications for inspection.
 * Same WHERE clause as countOrphanedAcceptedApplications, with row detail.
 */
export async function listOrphanedAcceptedApplications(limit = 50) {
  return db
    .select({
      applicationId: campaignApplications.id,
      campaignId: campaignApplications.campaignId,
      influencerId: campaignApplications.influencerId,
      proposedRate: campaignApplications.proposedRate,
      proposedCurrency: campaignApplications.proposedCurrency,
      respondedAt: campaignApplications.respondedAt,
      appliedAt: campaignApplications.appliedAt,
    })
    .from(campaignApplications)
    .leftJoin(
      campaignInfluencers,
      and(
        eq(campaignInfluencers.campaignId, campaignApplications.campaignId),
        eq(campaignInfluencers.influencerId, campaignApplications.influencerId),
      ),
    )
    .where(and(
      eq(campaignApplications.status, 'accepted'),
      isNull(campaignInfluencers.id),
    ))
    .orderBy(desc(campaignApplications.respondedAt))
    .limit(limit)
}

// ── Withdraw application ────────────────────────────────────────

export async function withdrawApplication(applicationId: string, influencerId: string) {
  const [app] = await db.select().from(campaignApplications)
    .where(and(eq(campaignApplications.id, applicationId), eq(campaignApplications.influencerId, influencerId)))
    .limit(1)

  if (!app) return { success: false, error: 'Application not found' }
  if (app.status !== 'pending') return { success: false, error: 'Can only withdraw pending applications' }

  await db.update(campaignApplications).set({ status: 'withdrawn' }).where(eq(campaignApplications.id, applicationId))
  return { success: true }
}

// ── Application count ───────────────────────────────────────────

export async function getApplicationCount(campaignId: string): Promise<number> {
  const [row] = await db.select({ cnt: count() }).from(campaignApplications)
    .where(and(eq(campaignApplications.campaignId, campaignId), ne(campaignApplications.status, 'withdrawn')))
  return Number(row.cnt)
}

// ── ICP match scores ────────────────────────────────────────────

export async function getIcpMatchScore(icpId: string, influencerId: string): Promise<number | null> {
  const [row] = await db.select({ score: icpMatchScores.matchScore }).from(icpMatchScores)
    .where(and(eq(icpMatchScores.icpId, icpId), eq(icpMatchScores.consumerId, influencerId)))
    .limit(1)
  return row?.score ?? null
}

export async function getIcpMatchScoresBulk(
  pairs: { icpId: string; consumerId: string }[]
): Promise<Map<string, number>> {
  if (pairs.length === 0) return new Map()

  const byIcp = new Map<string, string[]>()
  for (const p of pairs) {
    const list = byIcp.get(p.icpId) || []
    list.push(p.consumerId)
    byIcp.set(p.icpId, list)
  }

  const result = new Map<string, number>()
  for (const [icpId, consumerIds] of byIcp) {
    const rows = await db.select({ consumerId: icpMatchScores.consumerId, score: icpMatchScores.matchScore })
      .from(icpMatchScores)
      .where(and(eq(icpMatchScores.icpId, icpId), inArray(icpMatchScores.consumerId, consumerIds)))
    for (const r of rows) result.set(`${icpId}:${r.consumerId}`, r.score)
  }
  return result
}
