/**
 * Consent Enforcement Utilities
 *
 * Centralised consent checking for all data processing operations.
 * Phase 9: Reads from consent_records table (granular per-category consent).
 *
 * Data categories:
 *   Standard:   behavioral | demographic | psychographic | social
 *   Sensitive:  sensitive_health | sensitive_dietary | sensitive_religion | sensitive_caste
 *   Legacy:     tracking | personalization | analytics | marketing
 *
 * Usage:
 *   import { enforceConsent, checkConsent } from '@/lib/consent-enforcement'
 *   await enforceConsent(userId, 'behavioral', 'update_behavioral_attributes')
 */

import {
  hasConsentForCategory,
  type ConsentDataCategory,
} from '@/db/repositories/consentRepository'
import { logSensitiveDataAccess } from '@/lib/audit-log'

// Re-export so callers don't need to change their import paths
export type { ConsentDataCategory }

// Backward-compat alias — existing code using ConsentPurpose continues to work
export type ConsentPurpose = ConsentDataCategory

export interface ConsentCheckResult {
  allowed: boolean
  reason?: string
}

// ── Core enforcement functions ────────────────────────────────────

/**
 * Enforce consent for a specific category.
 * Throws if consent is not granted. Logs both approvals and denials.
 */
export async function enforceConsent(
  userId: string,
  purpose: ConsentDataCategory,
  operation: string
): Promise<void> {
  const allowed = await hasConsentForCategory(userId, purpose)

  if (!allowed) {
    await logSensitiveDataAccess(
      userId, 'system', `CONSENT_DENIED: ${operation}`,
      { purpose, operation, result: 'blocked' }
    ).catch(console.error)

    throw new Error(
      `User ${userId} has not consented to "${purpose}". Operation: ${operation}`
    )
  }

  await logSensitiveDataAccess(
    userId, 'system', `CONSENT_APPROVED: ${operation}`,
    { purpose, operation, result: 'allowed' }
  ).catch(console.error)
}

/**
 * Check consent without throwing. Returns { allowed, reason }.
 */
export async function checkConsent(
  userId: string,
  purpose: ConsentDataCategory
): Promise<ConsentCheckResult> {
  const allowed = await hasConsentForCategory(userId, purpose)
  if (!allowed) {
    return { allowed: false, reason: `User has not consented to "${purpose}"` }
  }
  return { allowed: true }
}

/**
 * Check multiple consent categories — requires ALL to be granted.
 */
export async function checkMultipleConsents(
  userId: string,
  purposes: ConsentDataCategory[]
): Promise<ConsentCheckResult> {
  for (const purpose of purposes) {
    const result = await checkConsent(userId, purpose)
    if (!result.allowed) return result
  }
  return { allowed: true }
}

/**
 * Check multiple consent categories — requires ANY ONE to be granted.
 */
export async function checkAnyConsent(
  userId: string,
  purposes: ConsentDataCategory[]
): Promise<ConsentCheckResult> {
  for (const purpose of purposes) {
    const allowed = await hasConsentForCategory(userId, purpose)
    if (allowed) return { allowed: true }
  }
  return {
    allowed: false,
    reason: `User has not consented to any of: ${purposes.join(', ')}`,
  }
}

// ── Operation → required consent categories map ───────────────────

export const CONSENT_REQUIREMENTS = {
  // ── Legacy event tracking (unchanged) ──────────────────────────
  'track_event':               ['tracking'] as ConsentDataCategory[],
  'track_product_view':        ['tracking'] as ConsentDataCategory[],
  'track_survey_interaction':  ['tracking'] as ConsentDataCategory[],

  // ── Behavioral analytics (unchanged) ───────────────────────────
  'update_behavioral_attributes':   ['tracking', 'analytics'] as ConsentDataCategory[],
  'calculate_engagement_score':     ['tracking', 'analytics'] as ConsentDataCategory[],
  'analyze_user_patterns':          ['tracking', 'analytics'] as ConsentDataCategory[],

  // ── Personalization (unchanged) ─────────────────────────────────
  'send_personalized_notification': ['personalization'] as ConsentDataCategory[],
  'get_recommendations':            ['personalization'] as ConsentDataCategory[],
  'personalize_content':            ['personalization'] as ConsentDataCategory[],

  // ── Marketing (unchanged) ───────────────────────────────────────
  'send_marketing_email':           ['marketing'] as ConsentDataCategory[],
  'send_promotional_notification':  ['marketing'] as ConsentDataCategory[],

  // ── Demographic analytics (unchanged) ───────────────────────────
  'track_email_demographics':       ['analytics'] as ConsentDataCategory[],
  'analyze_demographic_performance': ['analytics'] as ConsentDataCategory[],

  // ── Phase 9: Signal collection ──────────────────────────────────
  'collect_behavioral_signals':    ['behavioral'] as ConsentDataCategory[],
  'collect_demographic_signals':   ['demographic'] as ConsentDataCategory[],
  'collect_psychographic_signals': ['psychographic'] as ConsentDataCategory[],
  'collect_social_signals':        ['social'] as ConsentDataCategory[],

  // ── Phase 9: Sensitive signal collection (GDPR Art. 9) ─────────
  'collect_sensitive_health':      ['sensitive_health'] as ConsentDataCategory[],
  'collect_sensitive_dietary':     ['sensitive_dietary'] as ConsentDataCategory[],
  'collect_sensitive_religion':    ['sensitive_religion'] as ConsentDataCategory[],
  'collect_sensitive_caste':       ['sensitive_caste'] as ConsentDataCategory[],

  // ── Phase 9: ICP match scoring ──────────────────────────────────
  // Base score uses behavioral + personalization.
  // Psychographic/sensitive criteria are gated individually in the
  // scoring engine per-criterion — not enforced globally here.
  'compute_icp_match_score':       ['behavioral', 'personalization'] as ConsentDataCategory[],

  // ── Phase 9: Signal snapshot persistence ────────────────────────
  'persist_signal_snapshot':       ['behavioral'] as ConsentDataCategory[],
  'read_signal_history':           ['personalization'] as ConsentDataCategory[],

  // ── Phase 9: Social account connection ──────────────────────────
  'connect_social_account':        ['social'] as ConsentDataCategory[],
  'sync_social_signals':           ['social'] as ConsentDataCategory[],
} as const

export type ConsentOperation = keyof typeof CONSENT_REQUIREMENTS

/**
 * Enforce consent by operation name. Looks up required categories automatically.
 * Throws if any required category is not consented to.
 */
export async function enforceConsentByOperation(
  userId: string,
  operation: ConsentOperation
): Promise<void> {
  const purposes = CONSENT_REQUIREMENTS[operation]
  if (!purposes || purposes.length === 0) return

  const result = await checkMultipleConsents(userId, purposes as ConsentDataCategory[])
  if (!result.allowed) {
    throw new Error(`${result.reason}. Operation: ${operation}`)
  }
}

/**
 * Safe wrapper — returns null (or fallback) instead of throwing if consent denied.
 *
 * Usage:
 *   const data = await withConsentCheck(userId, 'behavioral', () => fetchData(), null)
 */
export async function withConsentCheck<T>(
  userId: string,
  purpose: ConsentDataCategory,
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  const allowed = await hasConsentForCategory(userId, purpose)
  if (!allowed) {
    console.log(
      `[ConsentEnforcement] Blocked — user ${userId} has not consented to "${purpose}"`
    )
    return fallback ?? null
  }
  return operation()
}

/**
 * Check whether a consent category is "sensitive" under GDPR Art. 9 / DPDP.
 * Sensitive categories require explicit consent and special-category handling.
 */
export function isSensitiveCategory(category: ConsentDataCategory): boolean {
  return category.startsWith('sensitive_')
}
