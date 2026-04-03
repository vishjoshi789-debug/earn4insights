/**
 * Signal Collection Service
 *
 * Orchestrates the collection and persistence of per-category consumer signals.
 * Each category is gated behind its own consent check before any data is read
 * or written. Only consented categories produce snapshots.
 *
 * Signal categories:
 *   behavioral    — engagement, category scores, feedback patterns
 *   demographic   — age, gender, location, education (from onboarding profile)
 *   psychographic — personality traits, values, aspirations
 *   social        — connected platform activity (social connections table)
 *
 * Called by:
 *   - Daily cron job (updateConsumerSignals.ts) → triggeredBy='cron_daily'
 *   - Onboarding completion → triggeredBy='onboarding_complete'
 *   - Post-feedback submission → triggeredBy='feedback_submit'
 *   - Social account sync → triggeredBy='social_sync'
 *
 * Architecture:
 *   Collection  → this file (consent gating + data assembly)
 *   Persistence → signalRepository (append-only snapshots)
 *   Computation → userSignalAggregator (heavy behavioral computation, reused here)
 */

import 'server-only'

import { db } from '@/db'
import { userProfiles, consumerSocialConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { checkConsent } from '@/lib/consent-enforcement'
import {
  insertSignalSnapshot,
  markSignalsComputed,
  type TriggeredBy,
} from '@/db/repositories/signalRepository'
import { aggregateUserSignals } from '@/lib/personalization/userSignalAggregator'

// ── Types ─────────────────────────────────────────────────────────

export type CollectionSummary = {
  userId: string
  triggeredBy: TriggeredBy
  collectedAt: string
  categories: {
    behavioral: 'collected' | 'skipped_no_consent' | 'skipped_no_data' | 'error'
    demographic: 'collected' | 'skipped_no_consent' | 'skipped_no_data' | 'error'
    psychographic: 'collected' | 'skipped_no_consent' | 'skipped_no_data' | 'error'
    social: 'collected' | 'skipped_no_consent' | 'skipped_no_data' | 'error'
  }
}

export type BehavioralSignals = {
  engagementScore: number
  engagementTier: string
  categoryScores: Record<string, number>
  totalFeedbackGiven: number
  avgRating: number | null
  sentimentBias: string
  feedbackFrequency: string
  recentCategories: string[]
  activeDayParts: string[]
  topDeviceType: string | null
  daysSinceLastActivity: number
}

export type DemographicSignals = {
  ageRange: string | null
  gender: string | null
  country: string | null
  city: string | null
  profession: string | null
  education: string | null
  language: string | null
}

export type PsychographicSignals = {
  values: string[]
  lifestyle: string[]
  personality: string[]
  aspirations: string[]
  attitudes: Record<string, string>
}

export type SocialSignals = {
  connectedPlatforms: string[]
  totalConnections: number
  lastSyncedAt: string | null
}

// ── Main Orchestrator ─────────────────────────────────────────────

/**
 * Collect and persist signals for all categories the user has consented to.
 * Runs all four collectors; categories without consent are silently skipped.
 * Returns a summary of which categories were collected vs. skipped.
 *
 * Safe to call from cron or event triggers — each category is independently
 * consent-gated, so partial runs (e.g., user revoked demographic but not
 * behavioral) produce correct partial snapshots.
 */
export async function collectAndPersistSignals(
  userId: string,
  triggeredBy: TriggeredBy
): Promise<CollectionSummary> {
  const collectedAt = new Date().toISOString()

  // Run all four collectors concurrently — they are independent
  const [behavioralResult, demographicResult, psychographicResult, socialResult] =
    await Promise.allSettled([
      collectBehavioralSignals(userId, triggeredBy),
      collectDemographicSignals(userId, triggeredBy),
      collectPsychographicSignals(userId, triggeredBy),
      collectSocialSignals(userId, triggeredBy),
    ])

  // Update lastSignalComputedAt on the profile regardless of which categories ran
  await markSignalsComputed(userId).catch(console.error)

  return {
    userId,
    triggeredBy,
    collectedAt,
    categories: {
      behavioral: settledToStatus(behavioralResult),
      demographic: settledToStatus(demographicResult),
      psychographic: settledToStatus(psychographicResult),
      social: settledToStatus(socialResult),
    },
  }
}

// ── Category Collectors ───────────────────────────────────────────

/**
 * Collect behavioral signals and persist a snapshot.
 * Requires 'behavioral' consent.
 *
 * Reuses aggregateUserSignals() for the heavy lifting; extracts only
 * the behavioral portion and stores it as a 'behavioral' category snapshot.
 *
 * Returns the signals object if collected, null if consent not granted.
 */
export async function collectBehavioralSignals(
  userId: string,
  triggeredBy: TriggeredBy = 'manual'
): Promise<BehavioralSignals | null> {
  const { allowed } = await checkConsent(userId, 'behavioral')
  if (!allowed) return null

  // aggregateUserSignals internally respects tracking/personalization consent
  // for sub-signals (device, geo, etc.) — we trust it for behavioral computation
  const vector = await aggregateUserSignals(userId)

  const signals: BehavioralSignals = {
    engagementScore: vector.engagementScore,
    engagementTier: vector.engagementTier,
    categoryScores: vector.categoryScores,
    totalFeedbackGiven: vector.behavioral.totalFeedbackGiven,
    avgRating: vector.behavioral.avgRating,
    sentimentBias: vector.behavioral.sentimentBias,
    feedbackFrequency: vector.behavioral.feedbackFrequency,
    recentCategories: vector.behavioral.recentCategories,
    activeDayParts: vector.behavioral.activeDayParts,
    topDeviceType: vector.behavioral.topDeviceType,
    daysSinceLastActivity: vector.behavioral.daysSinceLastActivity,
  }

  await insertSignalSnapshot(userId, 'behavioral', signals, triggeredBy)
  return signals
}

/**
 * Collect demographic signals from the user's onboarding profile and persist a snapshot.
 * Requires 'demographic' consent.
 *
 * Note: income range is NOT included here even if present in profile — it is
 * gated separately under the 'personalization' consent (see aggregateUserSignals).
 */
export async function collectDemographicSignals(
  userId: string,
  triggeredBy: TriggeredBy = 'manual'
): Promise<DemographicSignals | null> {
  const { allowed } = await checkConsent(userId, 'demographic')
  if (!allowed) return null

  const rows = await db
    .select({ demographics: userProfiles.demographics })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  const demographics = (rows[0]?.demographics as any) || {}

  // Only record fields that are actually present — don't pad with nulls
  const signals: DemographicSignals = {
    ageRange: demographics.ageRange || demographics.age || null,
    gender: demographics.gender || null,
    country: demographics.country || demographics.location || null,
    city: demographics.city || null,
    profession: demographics.profession || null,
    education: demographics.education || null,
    language: demographics.language || null,
  }

  const hasAnyData = Object.values(signals).some((v) => v !== null)
  if (!hasAnyData) return null

  await insertSignalSnapshot(userId, 'demographic', signals, triggeredBy)
  return signals
}

/**
 * Collect psychographic signals and persist a snapshot.
 * Requires 'psychographic' consent.
 *
 * Reads from userProfiles for any values/lifestyle/personality fields
 * collected during onboarding or profile enrichment. Returns null if
 * no psychographic data has been provided yet (consent granted but
 * no data collected yet is not an error).
 */
export async function collectPsychographicSignals(
  userId: string,
  triggeredBy: TriggeredBy = 'manual'
): Promise<PsychographicSignals | null> {
  const { allowed } = await checkConsent(userId, 'psychographic')
  if (!allowed) return null

  const rows = await db
    .select({ psychographic: userProfiles.psychographic })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  const psychographic = (rows[0]?.psychographic as any) || {}

  const signals: PsychographicSignals = {
    values: psychographic.values || [],
    lifestyle: psychographic.lifestyle || [],
    personality: psychographic.personality || [],
    aspirations: psychographic.aspirations || [],
    attitudes: psychographic.attitudes || {},
  }

  const hasAnyData =
    signals.values.length > 0 ||
    signals.lifestyle.length > 0 ||
    signals.personality.length > 0 ||
    signals.aspirations.length > 0 ||
    Object.keys(signals.attitudes).length > 0

  if (!hasAnyData) return null

  await insertSignalSnapshot(userId, 'psychographic', signals, triggeredBy)
  return signals
}

/**
 * Collect social signals from connected platform accounts and persist a snapshot.
 * Requires 'social' consent.
 *
 * Reads from consumer_social_connections — only metadata (which platforms are
 * connected, last sync time). Actual OAuth sync is deferred to a later phase.
 */
export async function collectSocialSignals(
  userId: string,
  triggeredBy: TriggeredBy = 'manual'
): Promise<SocialSignals | null> {
  const { allowed } = await checkConsent(userId, 'social')
  if (!allowed) return null

  const connections = await db
    .select({
      platform: consumerSocialConnections.platform,
      lastSyncedAt: consumerSocialConnections.lastSyncedAt,
    })
    .from(consumerSocialConnections)
    .where(eq(consumerSocialConnections.userId, userId))

  if (connections.length === 0) return null

  const latestSync = connections
    .map((c) => c.lastSyncedAt)
    .filter(Boolean)
    .sort()
    .reverse()[0]

  const signals: SocialSignals = {
    connectedPlatforms: connections.map((c) => c.platform),
    totalConnections: connections.length,
    lastSyncedAt: latestSync ? new Date(latestSync).toISOString() : null,
  }

  await insertSignalSnapshot(userId, 'social', signals, triggeredBy)
  return signals
}

// ── Helpers ───────────────────────────────────────────────────────

type CategoryStatus = CollectionSummary['categories']['behavioral']

function settledToStatus(result: PromiseSettledResult<any>): CategoryStatus {
  if (result.status === 'rejected') {
    console.error('[signalCollectionService] Collection error:', result.reason)
    return 'error'
  }
  if (result.value === null) return 'skipped_no_consent'
  return 'collected'
}
