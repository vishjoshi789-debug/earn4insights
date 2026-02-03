/**
 * Consent Enforcement Utilities
 * 
 * Centralized consent checking for all data processing operations
 * Ensures GDPR compliance across the entire codebase
 * 
 * Usage:
 * - Import enforceConsent before any sensitive data operation
 * - Returns error if consent not granted
 * - Logs all consent violations for audit
 */

import { hasConsent } from '@/db/repositories/userProfileRepository'
import { logSensitiveDataAccess } from '@/lib/audit-log'

export type ConsentPurpose = 'tracking' | 'personalization' | 'analytics' | 'marketing'

export interface ConsentCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Enforce consent for a specific purpose
 * Throws error if consent not granted
 */
export async function enforceConsent(
  userId: string,
  purpose: ConsentPurpose,
  operation: string
): Promise<void> {
  const allowed = await hasConsent(userId, purpose)
  
  if (!allowed) {
    // Log consent violation
    await logSensitiveDataAccess(
      userId,
      'system',
      `CONSENT_DENIED: ${operation}`,
      {
        purpose,
        operation,
        result: 'blocked'
      }
    ).catch(console.error)
    
    throw new Error(`User ${userId} has not consented to ${purpose}. Operation: ${operation}`)
  }
  
  // Log consent-approved operation
  await logSensitiveDataAccess(
    userId,
    'system',
    `CONSENT_APPROVED: ${operation}`,
    {
      purpose,
      operation,
      result: 'allowed'
    }
  ).catch(console.error)
}

/**
 * Check consent without throwing (returns boolean)
 */
export async function checkConsent(
  userId: string,
  purpose: ConsentPurpose
): Promise<ConsentCheckResult> {
  const allowed = await hasConsent(userId, purpose)
  
  if (!allowed) {
    return {
      allowed: false,
      reason: `User has not consented to ${purpose}`
    }
  }
  
  return { allowed: true }
}

/**
 * Check multiple consent purposes (requires ALL to be granted)
 */
export async function checkMultipleConsents(
  userId: string,
  purposes: ConsentPurpose[]
): Promise<ConsentCheckResult> {
  for (const purpose of purposes) {
    const result = await checkConsent(userId, purpose)
    if (!result.allowed) {
      return result
    }
  }
  
  return { allowed: true }
}

/**
 * Check if ANY of the consent purposes is granted
 */
export async function checkAnyConsent(
  userId: string,
  purposes: ConsentPurpose[]
): Promise<ConsentCheckResult> {
  for (const purpose of purposes) {
    const allowed = await hasConsent(userId, purpose)
    if (allowed) {
      return { allowed: true }
    }
  }
  
  return {
    allowed: false,
    reason: `User has not consented to any of: ${purposes.join(', ')}`
  }
}

/**
 * Consent requirements by operation type
 */
export const CONSENT_REQUIREMENTS = {
  // Event tracking
  'track_event': ['tracking'] as ConsentPurpose[],
  'track_product_view': ['tracking'] as ConsentPurpose[],
  'track_survey_interaction': ['tracking'] as ConsentPurpose[],
  
  // Behavioral analytics
  'update_behavioral_attributes': ['tracking', 'analytics'] as ConsentPurpose[],
  'calculate_engagement_score': ['tracking', 'analytics'] as ConsentPurpose[],
  'analyze_user_patterns': ['tracking', 'analytics'] as ConsentPurpose[],
  
  // Personalization
  'send_personalized_notification': ['personalization'] as ConsentPurpose[],
  'get_recommendations': ['personalization'] as ConsentPurpose[],
  'personalize_content': ['personalization'] as ConsentPurpose[],
  
  // Marketing
  'send_marketing_email': ['marketing'] as ConsentPurpose[],
  'send_promotional_notification': ['marketing'] as ConsentPurpose[],
  
  // Demographic tracking
  'track_email_demographics': ['analytics'] as ConsentPurpose[],
  'analyze_demographic_performance': ['analytics'] as ConsentPurpose[],
} as const

/**
 * Enforce consent based on operation type
 */
export async function enforceConsentByOperation(
  userId: string,
  operation: keyof typeof CONSENT_REQUIREMENTS
): Promise<void> {
  const purposes = CONSENT_REQUIREMENTS[operation]
  
  if (!purposes || purposes.length === 0) {
    return // No consent required
  }
  
  const result = await checkMultipleConsents(userId, purposes)
  
  if (!result.allowed) {
    throw new Error(`${result.reason}. Operation: ${operation}`)
  }
}

/**
 * Safe wrapper for consent-required operations
 * Returns null if consent not granted instead of throwing
 */
export async function withConsentCheck<T>(
  userId: string,
  purpose: ConsentPurpose,
  operation: () => Promise<T>,
  fallback?: T
): Promise<T | null> {
  const allowed = await hasConsent(userId, purpose)
  
  if (!allowed) {
    console.log(`[ConsentEnforcement] Operation blocked - user ${userId} has not consented to ${purpose}`)
    return fallback ?? null
  }
  
  return await operation()
}
