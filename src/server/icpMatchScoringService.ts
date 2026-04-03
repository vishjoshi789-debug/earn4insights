/**
 * ICP Match Scoring Service
 *
 * Computes how well a consumer matches a Brand's Ideal Consumer Profile (ICP).
 *
 * Scoring model
 * ─────────────
 * • Each ICP criterion has a weight (all weights must sum to 100 — enforced at ICP write time).
 * • Criteria that require a consent category the consumer hasn't granted are EXCLUDED.
 *   Their weight is removed from totalPossible so the consumer is not penalised.
 *   (Normalise upward, not downward.)
 * • Final score = Math.round((totalEarned / totalPossible) * 100), capped 0-100.
 *   If ALL criteria are unconsented → score = 0, breakdown explains why.
 *
 * Criterion matching
 * ──────────────────
 * Criteria keys map to consumer signal data:
 *   ageRange, gender, country, city, profession, education → demographic snapshot
 *   engagementTier, feedbackFrequency, sentimentBias       → behavioral snapshot
 *   interests / categoryScores                             → behavioral snapshot (overlap ratio)
 *   values, lifestyle, personality, aspirations            → psychographic snapshot
 *   health, dietary, religion, caste                       → sensitive attributes (consent-gated)
 *
 * Array-valued criteria (interests, values, lifestyle…) use overlap ratio:
 *   earned = weight × (overlapping_items / consumer_items)  capped at 1
 *
 * String-valued criteria: full weight if consumer value is in criterion.values, else 0.
 *
 * Output is stored in icp_match_scores (upserted) for cache/alert use.
 */

import 'server-only'

import { hasConsentForCategory } from '@/db/repositories/consentRepository'
import {
  getAllLatestSignals,
  type SignalCategory,
} from '@/db/repositories/signalRepository'
import {
  upsertMatchScore,
  getIcpById,
  getIcpsByBrand,
  getTopMatchesForIcp,
  type IcpCriterion,
  type IcpMatchBreakdown,
} from '@/db/repositories/icpRepository'
import { decryptSensitiveAttribute } from '@/db/repositories/sensitiveAttributeRepository'
import type { BrandIcp, IcpMatchScore } from '@/db/schema'

// ── Types ─────────────────────────────────────────────────────────

export type ScoringResult = {
  icpId: string
  consumerId: string
  matchScore: number          // 0-100 integer
  breakdown: IcpMatchBreakdown
  persisted: boolean          // true if upserted to icp_match_scores
}

// ── Main scoring function ─────────────────────────────────────────

/**
 * Compute the match score for a consumer against a single ICP.
 *
 * @param icpId      - ICP to score against
 * @param consumerId - Consumer user ID
 * @param persist    - If true (default), upserts the score to icp_match_scores
 * @returns ScoringResult with score + breakdown
 */
export async function scoreConsumerForIcp(
  icpId: string,
  consumerId: string,
  persist = true
): Promise<ScoringResult> {
  const icp = await getIcpById(icpId)
  if (!icp) {
    throw new Error(`ICP not found: ${icpId}`)
  }

  const breakdown = await computeBreakdown(icp, consumerId)
  const matchScore = breakdown.totalPossible > 0
    ? Math.min(100, Math.max(0, Math.round((breakdown.totalEarned / breakdown.totalPossible) * 100)))
    : 0

  let persisted = false
  if (persist) {
    await upsertMatchScore(icpId, consumerId, matchScore, breakdown)
    persisted = true
  }

  return { icpId, consumerId, matchScore, breakdown, persisted }
}

/**
 * Score a consumer against ALL active ICPs for a brand.
 * Used by the daily cron and post-feedback triggers.
 *
 * @returns Array of results, one per ICP.
 */
export async function scoreConsumerForBrand(
  brandId: string,
  consumerId: string,
  persist = true
): Promise<ScoringResult[]> {
  const icps = await getIcpsByBrand(brandId, { activeOnly: true })
  if (icps.length === 0) return []

  const results = await Promise.allSettled(
    icps.map((icp) => scoreConsumerForIcp(icp.id, consumerId, persist))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ScoringResult> => r.status === 'fulfilled')
    .map((r) => r.value)
}

/**
 * Batch-score multiple consumers against a single ICP.
 * Used by the daily recompute cron for stale scores.
 *
 * @param consumerIds - List of consumer IDs to score
 */
export async function batchScoreConsumersForIcp(
  icpId: string,
  consumerIds: string[]
): Promise<ScoringResult[]> {
  const results: ScoringResult[] = []

  // Sequential to avoid overwhelming DB with concurrent decryptions
  for (const consumerId of consumerIds) {
    try {
      const result = await scoreConsumerForIcp(icpId, consumerId, true)
      results.push(result)
    } catch (err) {
      console.error(
        `[icpMatchScoringService] Failed to score consumer=${consumerId} for icp=${icpId}:`,
        err
      )
    }
  }

  return results
}

// ── Breakdown computation ─────────────────────────────────────────

async function computeBreakdown(
  icp: BrandIcp,
  consumerId: string
): Promise<IcpMatchBreakdown> {
  const attributes = icp.attributes as {
    version: string
    criteria: Record<string, IcpCriterion>
    totalWeight: number
  }

  // Load all signal snapshots for this consumer in one DB round-trip
  const signals = await getAllLatestSignals(consumerId)

  const behavioralSignals = (signals.behavioral?.signals as Record<string, any>) ?? {}
  const demographicSignals = (signals.demographic?.signals as Record<string, any>) ?? {}
  const psychographicSignals = (signals.psychographic?.signals as Record<string, any>) ?? {}

  const criteriaScores: IcpMatchBreakdown['criteriaScores'] = {}
  const consentGaps: string[] = []
  let totalEarned = 0
  let totalPossible = 0

  for (const [criterionKey, criterion] of Object.entries(attributes.criteria)) {
    // ── Consent gate ───────────────────────────────────────────
    if (criterion.requiresConsentCategory) {
      const consentOk = await hasConsentForCategory(
        consumerId,
        criterion.requiresConsentCategory as any
      )
      if (!consentOk) {
        consentGaps.push(criterionKey)
        criteriaScores[criterionKey] = {
          earned: 0,
          max: criterion.weight,
          reason: 'consent_not_granted',
        }
        // Do NOT add to totalPossible — normalise upward
        continue
      }
    }

    totalPossible += criterion.weight

    // ── Resolve consumer value for this criterion ──────────────
    const { earned, matched, reason } = await resolveCriterionScore(
      criterionKey,
      criterion,
      consumerId,
      behavioralSignals,
      demographicSignals,
      psychographicSignals
    )

    totalEarned += earned
    criteriaScores[criterionKey] = {
      earned,
      max: criterion.weight,
      ...(matched !== undefined && { matched }),
      ...(reason !== undefined && { reason }),
    }
  }

  // ── Fix 4: Enforce required criteria ────────────────────────────
  // If any required criterion scored 0 (excluding consent gaps), zero the total.
  let requiredFailed: string[] = []
  for (const [criterionKey, criterion] of Object.entries(attributes.criteria)) {
    if (!criterion.required) continue
    if (consentGaps.includes(criterionKey)) continue // consent gap — not the consumer's fault
    const score = criteriaScores[criterionKey]
    if (score && score.earned === 0) {
      requiredFailed.push(criterionKey)
    }
  }

  if (requiredFailed.length > 0) {
    totalEarned = 0
  }

  // ── Build human-readable explainability string ─────────────────
  const matchPct = totalPossible > 0
    ? Math.round((totalEarned / totalPossible) * 100)
    : 0

  const gapNote = consentGaps.length > 0
    ? ` ${consentGaps.length} criteria skipped (no consent): ${consentGaps.join(', ')}.`
    : ''

  const requiredNote = requiredFailed.length > 0
    ? ` Score zeroed: required criteria not met (${requiredFailed.join(', ')}).`
    : ''

  const explainability =
    `Score ${matchPct}% based on ${Object.keys(attributes.criteria).length - consentGaps.length} ` +
    `of ${Object.keys(attributes.criteria).length} criteria.${gapNote}${requiredNote}`

  return {
    criteriaScores,
    totalEarned,
    totalPossible,
    consentGaps,
    explainability,
  }
}

// ── Criterion resolver ────────────────────────────────────────────

type CriterionResult = {
  earned: number
  matched?: string | string[]
  reason?: string
}

async function resolveCriterionScore(
  key: string,
  criterion: IcpCriterion,
  consumerId: string,
  behavioral: Record<string, any>,
  demographic: Record<string, any>,
  psychographic: Record<string, any>
): Promise<CriterionResult> {
  const { values: targetValues, weight } = criterion

  // ── Demographic string criteria ────────────────────────────────
  const demographicStringFields = ['ageRange', 'gender', 'country', 'city', 'profession', 'education']
  if (demographicStringFields.includes(key)) {
    const consumerVal: string | null = demographic[key] ?? null
    if (!consumerVal) return { earned: 0, reason: 'no_signal_data' }
    const match = targetValues.includes(consumerVal)
    return {
      earned: match ? weight : 0,
      matched: match ? consumerVal : undefined,
      reason: match ? undefined : 'value_not_in_criteria',
    }
  }

  // ── Behavioral string criteria ─────────────────────────────────
  const behavioralStringFields = ['engagementTier', 'feedbackFrequency', 'sentimentBias']
  if (behavioralStringFields.includes(key)) {
    const consumerVal: string | null = behavioral[key] ?? null
    if (!consumerVal) return { earned: 0, reason: 'no_signal_data' }
    const match = targetValues.includes(consumerVal)
    return {
      earned: match ? weight : 0,
      matched: match ? consumerVal : undefined,
      reason: match ? undefined : 'value_not_in_criteria',
    }
  }

  // ── Behavioral interests / category scores (array overlap ratio) ─
  if (key === 'interests' || key === 'categoryScores') {
    const categoryScores: Record<string, number> = behavioral.categoryScores ?? {}
    const consumerInterests = Object.entries(categoryScores)
      .filter(([, score]) => score >= 0.3)   // only meaningful interest signals
      .map(([cat]) => cat)

    if (consumerInterests.length === 0) return { earned: 0, reason: 'no_signal_data' }

    const overlap = targetValues.filter((v) => consumerInterests.includes(v))
    const ratio = Math.min(overlap.length / targetValues.length, 1)
    return {
      earned: Math.min(Math.round(weight * ratio), weight),
      matched: overlap.length > 0 ? overlap : undefined,
      reason: overlap.length === 0 ? 'no_category_overlap' : undefined,
    }
  }

  // ── Psychographic array criteria (values, lifestyle, personality, aspirations) ─
  const psychographicArrayFields = ['values', 'lifestyle', 'personality', 'aspirations']
  if (psychographicArrayFields.includes(key)) {
    const consumerArr: string[] = psychographic[key] ?? []
    if (consumerArr.length === 0) return { earned: 0, reason: 'no_signal_data' }

    const overlap = targetValues.filter((v) => consumerArr.includes(v))
    const ratio = Math.min(overlap.length / targetValues.length, 1)
    return {
      earned: Math.min(Math.round(weight * ratio), weight),
      matched: overlap.length > 0 ? overlap : undefined,
      reason: overlap.length === 0 ? 'no_value_overlap' : undefined,
    }
  }

  // ── Sensitive data criteria (decrypted on the fly) ─────────────
  // criterion.requiresConsentCategory is already checked before we get here.
  const sensitiveFieldMap: Record<string, 'health' | 'dietary' | 'religion' | 'caste'> = {
    health: 'health',
    dietary: 'dietary',
    religion: 'religion',
    caste: 'caste',
  }

  if (sensitiveFieldMap[key]) {
    const attributeCategory = sensitiveFieldMap[key]
    let payload: Record<string, any> | null = null

    try {
      payload = await decryptSensitiveAttribute(consumerId, attributeCategory) as any
    } catch {
      return { earned: 0, reason: 'decryption_error' }
    }

    if (!payload) return { earned: 0, reason: 'no_sensitive_data' }

    // Health: match against payload.interests[]
    if (attributeCategory === 'health') {
      const interests: string[] = payload.interests ?? []
      const overlap = targetValues.filter((v) => interests.includes(v))
      const ratio = Math.min(overlap.length / targetValues.length, 1)
      return {
        earned: Math.min(Math.round(weight * ratio), weight),
        matched: overlap.length > 0 ? overlap : undefined,
      }
    }

    // Dietary: match against payload.preferences[]
    if (attributeCategory === 'dietary') {
      const prefs: string[] = payload.preferences ?? []
      const overlap = targetValues.filter((v) => prefs.includes(v))
      const ratio = Math.min(overlap.length / targetValues.length, 1)
      return {
        earned: Math.min(Math.round(weight * ratio), weight),
        matched: overlap.length > 0 ? overlap : undefined,
      }
    }

    // Religion: match against payload.faith (string)
    if (attributeCategory === 'religion') {
      const faith: string | null = payload.faith ?? null
      if (!faith) return { earned: 0, reason: 'no_signal_data' }
      const match = targetValues.includes(faith)
      return {
        earned: match ? weight : 0,
        matched: match ? faith : undefined,
      }
    }

    // Caste: match against payload.community (string)
    if (attributeCategory === 'caste') {
      const community: string | null = payload.community ?? null
      if (!community) return { earned: 0, reason: 'no_signal_data' }
      const match = targetValues.includes(community)
      return {
        earned: match ? weight : 0,
        matched: match ? community : undefined,
      }
    }
  }

  // Unknown criterion key — zero score with note
  return { earned: 0, reason: `unknown_criterion_key:${key}` }
}

// ── Convenience re-exports ────────────────────────────────────────

export { getTopMatchesForIcp }
export type { IcpMatchScore }
