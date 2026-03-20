import { db } from '@/db'
import {
  contributionEvents,
  userReputation,
  brandRewardConfigs,
  trustFlags,
  products,
} from '@/db/schema'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import { scoreAndPersist } from './aiScoringService'
import { awardPoints, POINT_VALUES } from './pointsService'

/**
 * Contribution Intelligence Pipeline
 *
 * Flow:
 *   1. recordContribution()  → inserts event, runs anti-gaming checks
 *   2. AI scoring             → scores the contribution (async)
 *   3. computeReward()        → brand-weight × quality × reputation
 *   4. awardTokens()          → credits the user's point balance
 *   5. updateReputation()     → adjusts user reputation score
 */

// ── Base point values per contribution type ───────────────────
const BASE_TOKENS: Record<string, number> = {
  feedback_submit: 25,
  survey_complete: 50,
  community_post: 10,
  community_reply: 5,
  community_upvote_received: 2,
  poll_vote: 1,
}

// ── Reputation tier thresholds & multipliers ──────────────────
const REPUTATION_TIERS = [
  { tier: 'diamond', minScore: 90, multiplier: 2.0 },
  { tier: 'platinum', minScore: 75, multiplier: 1.6 },
  { tier: 'gold', minScore: 60, multiplier: 1.3 },
  { tier: 'silver', minScore: 40, multiplier: 1.1 },
  { tier: 'bronze', minScore: 0, multiplier: 1.0 },
] as const

function getTier(reputationScore: number) {
  return REPUTATION_TIERS.find(t => reputationScore >= t.minScore) || REPUTATION_TIERS[REPUTATION_TIERS.length - 1]
}

// ── Quality → multiplier mapping (non-linear: rewards quality) ─
function qualityToMultiplier(qualityScore: number): number {
  if (qualityScore >= 90) return 2.5
  if (qualityScore >= 75) return 1.8
  if (qualityScore >= 60) return 1.3
  if (qualityScore >= 40) return 1.0
  if (qualityScore >= 20) return 0.5
  return 0.1 // near-zero for spam/garbage
}

// ── Anti-gaming: velocity check ───────────────────────────────
async function checkVelocity(userId: string, contributionType: string): Promise<{ ok: boolean; reason?: string }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contributionEvents)
    .where(
      and(
        eq(contributionEvents.userId, userId),
        eq(contributionEvents.contributionType, contributionType),
        gte(contributionEvents.createdAt, oneHourAgo),
      ),
    )

  const count = result?.count ?? 0

  // Per-type limits per hour
  const limits: Record<string, number> = {
    feedback_submit: 5,
    survey_complete: 10,
    community_post: 10,
    community_reply: 30,
    community_upvote_received: 50,
    poll_vote: 20,
  }

  const limit = limits[contributionType] ?? 20
  if (count >= limit) {
    return { ok: false, reason: `velocity_abuse: ${count}/${limit} ${contributionType} in last hour` }
  }
  return { ok: true }
}

// ── Anti-gaming: duplicate content check ──────────────────────
async function checkDuplicate(userId: string, rawContent: string): Promise<boolean> {
  if (!rawContent || rawContent.length < 20) return false

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const recent = await db
    .select({ rawContent: contributionEvents.rawContent })
    .from(contributionEvents)
    .where(
      and(
        eq(contributionEvents.userId, userId),
        gte(contributionEvents.createdAt, oneDayAgo),
      ),
    )
    .orderBy(desc(contributionEvents.createdAt))
    .limit(20)

  const newWords = new Set(rawContent.toLowerCase().split(/\s+/).filter(Boolean))
  if (newWords.size === 0) return false

  for (const r of recent) {
    if (!r.rawContent) continue
    const existingWords = r.rawContent.toLowerCase().split(/\s+/).filter(Boolean)
    const overlap = existingWords.filter(w => newWords.has(w)).length
    if (existingWords.length > 0 && overlap / existingWords.length > 0.8) {
      return true // duplicate
    }
  }
  return false
}

// ── Get brand weight for a contribution type + product ────────
async function getBrandWeight(brandId: string | null, productId: string | null | undefined, contributionType: string): Promise<{ weight: number; priorityKeywords: string[] }> {
  if (!brandId) return { weight: 1.0, priorityKeywords: [] }

  const configs = await db
    .select()
    .from(brandRewardConfigs)
    .where(
      and(
        eq(brandRewardConfigs.brandId, brandId),
        eq(brandRewardConfigs.contributionType, contributionType),
        eq(brandRewardConfigs.isActive, true),
      ),
    )
    .limit(2)

  // Prefer product-specific config, fall back to brand-wide
  const specific = configs.find(c => c.productId === productId)
  const brandWide = configs.find(c => !c.productId)
  const config = specific || brandWide

  if (!config) return { weight: 1.0, priorityKeywords: [] }
  const bm = config.bonusMultiplier || 1.0
  return {
    weight: config.weight * bm,
    priorityKeywords: config.priorityKeywords ?? [],
  }
}

// ── Get or create user reputation ─────────────────────────────
async function getOrCreateReputation(userId: string) {
  const existing = await db
    .select()
    .from(userReputation)
    .where(eq(userReputation.userId, userId))
    .limit(1)

  if (existing.length > 0) return existing[0]

  const [created] = await db
    .insert(userReputation)
    .values({ userId })
    .onConflictDoUpdate({
      target: userReputation.userId,
      set: { updatedAt: sql`now()` },
    })
    .returning()

  return created
}

// ── Update reputation after scoring ───────────────────────────
async function updateReputation(userId: string, qualityScore: number) {
  const rep = await getOrCreateReputation(userId)

  // Rolling average quality (exponential moving average with α=0.1)
  const alpha = 0.1
  const newAvg = rep.qualityAvg * (1 - alpha) + qualityScore * alpha

  // Streak: if last contribution was within 48h, continue streak
  const twoAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const newStreak = rep.lastContributionAt && rep.lastContributionAt > twoAgo
    ? rep.streakDays + 1
    : 1

  // Compute new reputation score (0-100)
  // 60% quality avg + 20% consistency (streak) + 20% volume (log contributions)
  const streakFactor = Math.min(100, newStreak * 3)
  const volumeFactor = Math.min(100, Math.log2(rep.totalContributions + 2) * 15)
  const flagPenalty = Math.min(40, rep.flagCount * 10)
  const newRepScore = Math.max(0, Math.min(100, Math.round(
    newAvg * 0.60 + streakFactor * 0.20 + volumeFactor * 0.20 - flagPenalty,
  )))

  const tierInfo = getTier(newRepScore)

  await db
    .update(userReputation)
    .set({
      reputationScore: newRepScore,
      tier: tierInfo.tier,
      earningMultiplier: tierInfo.multiplier,
      totalContributions: sql`${userReputation.totalContributions} + 1`,
      qualityAvg: newAvg,
      streakDays: newStreak,
      lastContributionAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userReputation.userId, userId))
}

// ── Flag suspicious contribution ──────────────────────────────
async function flagUser(userId: string, flagType: string, details: string, eventId?: string) {
  await db.insert(trustFlags).values({
    userId,
    flagType,
    severity: flagType === 'bot_behavior' ? 'severe' : 'warning',
    details,
    contributionEventId: eventId || null,
  })

  // Increment flag count on reputation
  await db
    .update(userReputation)
    .set({
      flagCount: sql`${userReputation.flagCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(userReputation.userId, userId))
}

// ════════════════════════════════════════════════════════════════
// PUBLIC API — recordContribution
// ════════════════════════════════════════════════════════════════

interface ContributionInput {
  userId: string
  contributionType: string
  rawContent?: string
  productId?: string | null
  sourceId?: string
  metadata?: Record<string, unknown>
}

/**
 * Main entry point: records a user contribution, scores it with AI,
 * computes reward with brand weighting + reputation multiplier,
 * and awards tokens/points.
 *
 * This runs async — callers should fire-and-forget (non-blocking).
 */
export async function recordContribution(input: ContributionInput): Promise<void> {
  const {
    userId,
    contributionType,
    rawContent,
    productId,
    sourceId,
    metadata,
  } = input

  try {
    // ── 1. Anti-gaming: velocity check ─────────────────────────
    const velocity = await checkVelocity(userId, contributionType)
    if (!velocity.ok) {
      await flagUser(userId, 'velocity_abuse', velocity.reason || 'Rate limit exceeded')
      return // silently drop — don't award anything
    }

    // ── 2. Anti-gaming: duplicate check ────────────────────────
    if (rawContent && await checkDuplicate(userId, rawContent)) {
      await flagUser(userId, 'duplicate_farming', `Duplicate content detected for ${contributionType}`)
      return
    }

    // ── 3. Resolve brand from product ──────────────────────────
    let brandId: string | null = null
    if (productId) {
      const [product] = await db
        .select({ ownerId: products.ownerId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      brandId = product?.ownerId ?? null
    }

    // ── 4. Insert contribution event ───────────────────────────
    const basePoints = BASE_TOKENS[contributionType] ?? 5

    const [event] = await db
      .insert(contributionEvents)
      .values({
        userId,
        contributionType,
        rawContent: rawContent?.slice(0, 10000) || null,
        metadata: metadata || null,
        brandId,
        productId: productId || null,
        sourceId: sourceId || null,
        basePoints,
        status: 'pending',
      })
      .returning()

    // ── 5. Get reputation ──────────────────────────────────────
    const rep = await getOrCreateReputation(userId)

    // ── 6. AI quality scoring ──────────────────────────────────
    const { weight: bWeight, priorityKeywords } = await getBrandWeight(brandId, productId, contributionType)

    const scoreResult = await scoreAndPersist(event.id, {
      rawContent: rawContent || '',
      contributionType,
      brandPriorityKeywords: priorityKeywords,
      userHistorySummary: `${rep.totalContributions} contributions, avg quality ${Math.round(rep.qualityAvg)}`,
    })

    // ── 7. Check if flagged ────────────────────────────────────
    if (scoreResult.authenticityScore < 20) {
      await flagUser(userId, 'low_effort_pattern', `Authenticity score ${scoreResult.authenticityScore}/100`, event.id)
      // Still record but mark as flagged, don't reward
      return
    }

    // ── 8. Compute final reward ────────────────────────────────
    // formula: base × qualityMultiplier × brandWeight × reputationMultiplier
    const qualityMult = qualityToMultiplier(scoreResult.qualityScore)
    const repMult = rep.earningMultiplier
    const finalTokens = Math.max(1, Math.round(basePoints * qualityMult * bWeight * repMult))

    // ── 9. Persist reward calculations ─────────────────────────
    await db
      .update(contributionEvents)
      .set({
        brandWeight: bWeight,
        qualityMultiplier: qualityMult,
        reputationMultiplier: repMult,
        finalTokens,
        status: 'rewarded',
      })
      .where(eq(contributionEvents.id, event.id))

    // ── 10. Award tokens (uses existing points system) ─────────
    // Award the DIFFERENCE between AI-calculated tokens and base points
    // because the existing wiring already awards base points via awardPoints()
    // For contribution types that don't already award points, award full amount
    const alreadyAwardedTypes = ['community_post', 'community_reply', 'community_upvote_received']
    const alreadyAwarded = alreadyAwardedTypes.includes(contributionType)
      ? (POINT_VALUES as Record<string, number>)[contributionType] ?? 0
      : 0

    const bonusTokens = finalTokens - alreadyAwarded
    if (bonusTokens > 0) {
      await awardPoints(
        userId,
        bonusTokens,
        `ai_bonus_${contributionType}`,
        event.id,
        `AI quality bonus (score: ${scoreResult.qualityScore}/100, ×${qualityMult.toFixed(1)})`,
      )
    }

    // ── 11. Update reputation ──────────────────────────────────
    await updateReputation(userId, scoreResult.qualityScore)

  } catch (err) {
    console.error('[ContributionPipeline] Error processing contribution:', err)
    // Non-blocking — don't throw, the original action already succeeded
  }
}

/**
 * Get a user's reputation summary.
 */
export async function getUserReputation(userId: string) {
  const rep = await getOrCreateReputation(userId)
  const tierInfo = getTier(rep.reputationScore)
  return {
    ...rep,
    tierLabel: tierInfo.tier,
    nextTier: REPUTATION_TIERS.find(t => t.minScore > rep.reputationScore)?.tier ?? null,
    nextTierScore: REPUTATION_TIERS.find(t => t.minScore > rep.reputationScore)?.minScore ?? null,
  }
}
