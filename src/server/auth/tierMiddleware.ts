/**
 * Tier-based Feature Gating Middleware
 * 
 * Protects API routes and server actions based on subscription tier
 * 
 * Usage examples:
 * 
 * // In API route:
 * export async function GET(req: Request) {
 *   const session = await requireAuth()
 *   await requireFeature(session.user.id, 'canViewIndividual')
 *   
 *   // ... route logic
 * }
 * 
 * // In server action:
 * export async function exportData() {
 *   'use server'
 *   const session = await requireAuth()
 *   await requirePaidTier(session.user.id)
 *   
 *   // ... export logic
 * }
 */

import 'server-only'
import {
  getBrandSubscription,
  canAccessFeature,
  getUpgradeCTA,
  type SubscriptionTier,
  type TierFeatures,
} from '../subscriptions/subscriptionService'

// ============================================================================
// ERROR TYPES
// ============================================================================

export class TierError extends Error {
  constructor(
    message: string,
    public readonly requiredTier: SubscriptionTier,
    public readonly currentTier: SubscriptionTier,
    public readonly upgradeCTA: {
      title: string
      description: string
    }
  ) {
    super(message)
    this.name = 'TierError'
  }
}

export class FeatureError extends Error {
  constructor(
    message: string,
    public readonly feature: keyof TierFeatures,
    public readonly upgradeCTA: {
      title: string
      description: string
      minimumTier: SubscriptionTier
    }
  ) {
    super(message)
    this.name = 'FeatureError'
  }
}

// ============================================================================
// TIER REQUIREMENTS
// ============================================================================

/**
 * Require that user has at least the specified tier
 * Throws TierError if requirement not met
 */
export async function requireTier(
  brandId: string,
  minimumTier: SubscriptionTier
): Promise<void> {
  const sub = await getBrandSubscription(brandId)
  
  const tierOrder: SubscriptionTier[] = ['free', 'pro', 'enterprise']
  const currentIndex = tierOrder.indexOf(sub.tier)
  const requiredIndex = tierOrder.indexOf(minimumTier)
  
  if (currentIndex < requiredIndex) {
    throw new TierError(
      `This feature requires ${minimumTier} tier`,
      minimumTier,
      sub.tier,
      {
        title: `Upgrade to ${minimumTier}`,
        description: `You're currently on the ${sub.tier} plan`,
      }
    )
  }
}

/**
 * Require paid tier (pro or enterprise)
 */
export async function requirePaidTier(brandId: string): Promise<void> {
  const sub = await getBrandSubscription(brandId)
  
  if (sub.tier === 'free') {
    throw new TierError(
      'This feature requires a paid subscription',
      'pro',
      'free',
      {
        title: 'Upgrade to Pro',
        description: 'Unlock individual feedback access, media playback, and exports',
      }
    )
  }
}

/**
 * Require enterprise tier
 */
export async function requireEnterpriseTier(brandId: string): Promise<void> {
  return requireTier(brandId, 'enterprise')
}

// ============================================================================
// FEATURE REQUIREMENTS
// ============================================================================

/**
 * Require specific feature access
 * Throws FeatureError if feature not available
 */
export async function requireFeature(
  brandId: string,
  feature: keyof TierFeatures
): Promise<void> {
  const hasAccess = await canAccessFeature(brandId, feature)
  
  if (!hasAccess) {
    const cta = getUpgradeCTA(feature)
    throw new FeatureError(
      `This feature is not available on your current plan`,
      feature,
      cta
    )
  }
}

/**
 * Require ability to view individual feedback
 */
export async function requireIndividualFeedbackAccess(brandId: string): Promise<void> {
  return requireFeature(brandId, 'canViewIndividual')
}

/**
 * Require ability to play/download media
 */
export async function requireMediaAccess(brandId: string): Promise<void> {
  const sub = await getBrandSubscription(brandId)
  
  if (!sub.features.canPlayAudio && !sub.features.canPlayVideo && !sub.features.canViewImages) {
    const cta = getUpgradeCTA('canPlayAudio')
    throw new FeatureError(
      'Media access requires a paid subscription',
      'canPlayAudio',
      cta
    )
  }
}

/**
 * Require ability to export data
 */
export async function requireExportAccess(brandId: string): Promise<void> {
  return requireFeature(brandId, 'canExportCSV')
}

/**
 * Require API access
 */
export async function requireAPIAccess(brandId: string): Promise<void> {
  return requireFeature(brandId, 'canAccessAPI')
}

// ============================================================================
// SOFT CHECKS (No throwing, returns boolean)
// ============================================================================

/**
 * Check if feature is available (non-throwing version)
 */
export async function checkFeatureAccess(
  brandId: string,
  feature: keyof TierFeatures
): Promise<{
  allowed: boolean
  tier: SubscriptionTier
  upgradeCTA?: {
    title: string
    description: string
    minimumTier: SubscriptionTier
  }
}> {
  const sub = await getBrandSubscription(brandId)
  const allowed = sub.features[feature] as boolean
  
  if (!allowed) {
    return {
      allowed: false,
      tier: sub.tier,
      upgradeCTA: getUpgradeCTA(feature),
    }
  }
  
  return {
    allowed: true,
    tier: sub.tier,
  }
}

/**
 * Get user-friendly error response for tier errors
 */
export function getTierErrorResponse(error: TierError | FeatureError): {
  error: string
  code: string
  upgrade: {
    title: string
    description: string
    minimumTier?: SubscriptionTier
  }
} {
  if (error instanceof TierError) {
    return {
      error: error.message,
      code: 'TIER_REQUIRED',
      upgrade: {
        title: error.upgradeCTA.title,
        description: error.upgradeCTA.description,
        minimumTier: error.requiredTier,
      },
    }
  }
  
  if (error instanceof FeatureError) {
    return {
      error: error.message,
      code: 'FEATURE_REQUIRED',
      upgrade: {
        title: error.upgradeCTA.title,
        description: error.upgradeCTA.description,
        minimumTier: error.upgradeCTA.minimumTier,
      },
    }
  }
  
  return {
    error: 'Access denied',
    code: 'ACCESS_DENIED',
    upgrade: {
      title: 'Upgrade your plan',
      description: 'This feature requires a higher tier subscription',
    },
  }
}

// ============================================================================
// USAGE LIMITS
// ============================================================================

/**
 * Check if brand can add another product
 */
export async function checkProductLimit(
  brandId: string,
  currentProductCount: number
): Promise<{
  allowed: boolean
  limit: number
  current: number
  upgradeCTA?: {
    title: string
    description: string
  }
}> {
  const sub = await getBrandSubscription(brandId)
  const limit = sub.features.maxProducts
  const allowed = currentProductCount < limit
  
  if (!allowed) {
    return {
      allowed: false,
      limit,
      current: currentProductCount,
      upgradeCTA: {
        title: 'Upgrade to add more products',
        description: `You've reached your limit of ${limit} product${limit > 1 ? 's' : ''}`,
      },
    }
  }
  
  return {
    allowed: true,
    limit,
    current: currentProductCount,
  }
}

/**
 * Check if brand can export more data this month
 */
export async function checkExportLimit(
  brandId: string,
  exportsThisMonth: number
): Promise<{
  allowed: boolean
  limit: number | null
  current: number
  upgradeCTA?: {
    title: string
    description: string
  }
}> {
  const sub = await getBrandSubscription(brandId)
  const limit = sub.features.maxExportsPerMonth
  
  // null means unlimited
  if (limit === null) {
    return {
      allowed: true,
      limit: null,
      current: exportsThisMonth,
    }
  }
  
  const allowed = exportsThisMonth < limit
  
  if (!allowed) {
    return {
      allowed: false,
      limit,
      current: exportsThisMonth,
      upgradeCTA: {
        title: 'Monthly export limit reached',
        description: `Upgrade for ${sub.tier === 'pro' ? 'unlimited' : 'more'} exports`,
      },
    }
  }
  
  return {
    allowed: true,
    limit,
    current: exportsThisMonth,
  }
}
