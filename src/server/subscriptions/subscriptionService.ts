/**
 * Subscription Service
 * 
 * Manages brand subscription tiers and feature access
 * 
 * Architecture inspired by:
 * - Vercel (usage-based + tier-based limits)
 * - GitHub (free vs pro vs enterprise)
 * - Stripe (subscription management)
 * 
 * Tier Structure:
 * 
 * FREE:
 * - View aggregate analytics (NPS, sentiment %, volume)
 * - See feedback count by modality  
 * - View trends over time
 * - Max 1 product
 * 
 * PRO:
 * - Everything in Free
 * - View individual feedback (full text, transcripts)
 * - Play/download audio, video, images
 * - Export CSV with all fields
 * - Advanced filters & segmentation
 * - Max 10 products
 * 
 * ENTERPRISE:
 * - Everything in Pro
 * - API access
 * - Custom integrations
 * - Unlimited products
 * - Priority support
 */

import 'server-only'
import { db } from '@/db'
import { brandSubscriptions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing'

/**
 * Features available per tier
 */
export interface TierFeatures {
  // Analytics access
  canViewAggregate: boolean
  canViewIndividual: boolean
  canViewTrends: boolean
  
  // Media access
  canPlayAudio: boolean
  canPlayVideo: boolean
  canViewImages: boolean
  canDownloadMedia: boolean
  
  // Data export
  canExportCSV: boolean
  canExportJSON: boolean
  
  // Advanced features
  canUseAdvancedFilters: boolean
  canAccessAPI: boolean
  canUseWebhooks: boolean
  
  // Limits
  maxProducts: number
  maxResponsesPerMonth: number | null // null = unlimited
  maxExportsPerMonth: number | null
}

/**
 * Subscription details
 */
export interface BrandSubscription {
  id: string
  brandId: string
  tier: SubscriptionTier
  status: SubscriptionStatus
  features: TierFeatures
  
  // Billing info
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  trialEnd?: Date
  
  // Stripe
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

/**
 * Feature matrix by tier
 * Single source of truth for what each tier includes
 */
const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  free: {
    canViewAggregate: true,
    canViewIndividual: false,
    canViewTrends: true,
    
    canPlayAudio: false,
    canPlayVideo: false,
    canViewImages: false,
    canDownloadMedia: false,
    
    canExportCSV: false,
    canExportJSON: false,
    
    canUseAdvancedFilters: false,
    canAccessAPI: false,
    canUseWebhooks: false,
    
    maxProducts: 1,
    maxResponsesPerMonth: null, // unlimited responses
    maxExportsPerMonth: 0,
  },
  
  pro: {
    canViewAggregate: true,
    canViewIndividual: true,
    canViewTrends: true,
    
    canPlayAudio: true,
    canPlayVideo: true,
    canViewImages: true,
    canDownloadMedia: true,
    
    canExportCSV: true,
    canExportJSON: true,
    
    canUseAdvancedFilters: true,
    canAccessAPI: false,
    canUseWebhooks: false,
    
    maxProducts: 10,
    maxResponsesPerMonth: null,
    maxExportsPerMonth: 100,
  },
  
  enterprise: {
    canViewAggregate: true,
    canViewIndividual: true,
    canViewTrends: true,
    
    canPlayAudio: true,
    canPlayVideo: true,
    canViewImages: true,
    canDownloadMedia: true,
    
    canExportCSV: true,
    canExportJSON: true,
    
    canUseAdvancedFilters: true,
    canAccessAPI: true,
    canUseWebhooks: true,
    
    maxProducts: 999999, // effectively unlimited
    maxResponsesPerMonth: null,
    maxExportsPerMonth: null,
  },
}

// ============================================================================
// SUBSCRIPTION CRUD
// ============================================================================

/**
 * Get subscription for a brand
 * Returns free tier if no subscription exists
 */
export async function getBrandSubscription(brandId: string): Promise<BrandSubscription> {
  const rows = await db
    .select()
    .from(brandSubscriptions)
    .where(eq(brandSubscriptions.brandId, brandId))
    .limit(1)
  
  if (rows.length === 0) {
    // No subscription exists → return default free tier
    return {
      id: 'default',
      brandId,
      tier: 'free',
      status: 'active',
      features: TIER_FEATURES.free,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
  
  const sub = rows[0]
  const tier = (sub.tier || 'free') as SubscriptionTier
  
  // Apply feature overrides if they exist
  let features = { ...TIER_FEATURES[tier] }
  if (sub.featureOverrides) {
    features = { ...features, ...(sub.featureOverrides as Partial<TierFeatures>) }
  }
  
  return {
    id: sub.id,
    brandId: sub.brandId,
    tier,
    status: (sub.status || 'active') as SubscriptionStatus,
    features,
    currentPeriodStart: sub.currentPeriodStart || undefined,
    currentPeriodEnd: sub.currentPeriodEnd || undefined,
    trialEnd: sub.trialEnd || undefined,
    stripeCustomerId: sub.stripeCustomerId || undefined,
    stripeSubscriptionId: sub.stripeSubscriptionId || undefined,
    createdAt: new Date(sub.createdAt),
    updatedAt: new Date(sub.updatedAt),
  }
}

/**
 * Create a new subscription (typically when upgrading from free)
 */
export async function createBrandSubscription(params: {
  brandId: string
  tier: SubscriptionTier
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  stripePriceId?: string
  trialEnd?: Date
}): Promise<BrandSubscription> {
  const id = randomUUID()
  const now = new Date()
  
  await db.insert(brandSubscriptions).values({
    id,
    brandId: params.brandId,
    tier: params.tier,
    status: params.trialEnd ? 'trialing' : 'active',
    stripeCustomerId: params.stripeCustomerId,
    stripeSubscriptionId: params.stripeSubscriptionId,
    stripePriceId: params.stripePriceId,
    trialEnd: params.trialEnd,
    currentPeriodStart: now,
    // Default to monthly billing
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  })
  
  return getBrandSubscription(params.brandId)
}

/**
 * Update subscription tier
 */
export async function updateBrandSubscription(
  brandId: string,
  updates: {
    tier?: SubscriptionTier
    status?: SubscriptionStatus
    stripeSubscriptionId?: string
    currentPeriodStart?: Date
    currentPeriodEnd?: Date
    featureOverrides?: Partial<TierFeatures>
  }
): Promise<BrandSubscription> {
  await db
    .update(brandSubscriptions)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
  
  return getBrandSubscription(brandId)
}

/**
 * Cancel subscription (downgrade to free at end of period)
 */
export async function cancelBrandSubscription(brandId: string): Promise<BrandSubscription> {
  const sub = await getBrandSubscription(brandId)
  
  await db
    .update(brandSubscriptions)
    .set({
      status: 'cancelled',
      canceledAt: new Date(),
      cancelAt: sub.currentPeriodEnd || new Date(),
      updatedAt: new Date(),
    })
    .where(eq(brandSubscriptions.brandId, brandId))
  
  return getBrandSubscription(brandId)
}

// ============================================================================
// FEATURE CHECKS (Convenience Functions)
// ============================================================================

/**
 * Check if brand can access a specific feature
 */
export async function canAccessFeature(
  brandId: string,
  feature: keyof TierFeatures
): Promise<boolean> {
  const sub = await getBrandSubscription(brandId)
  return sub.features[feature] as boolean
}

/**
 * Check if brand can view individual feedback items
 */
export async function canViewIndividualFeedback(brandId: string): Promise<boolean> {
  return canAccessFeature(brandId, 'canViewIndividual')
}

/**
 * Check if brand can play/download media
 */
export async function canAccessMedia(brandId: string): Promise<boolean> {
  const sub = await getBrandSubscription(brandId)
  return sub.features.canPlayAudio || sub.features.canPlayVideo || sub.features.canViewImages
}

/**
 * Check if brand can export data
 */
export async function canExportData(brandId: string): Promise<boolean> {
  return canAccessFeature(brandId, 'canExportCSV')
}

/**
 * Check if brand has reached product limit
 */
export async function canAddProduct(
  brandId: string,
  currentProductCount: number
): Promise<boolean> {
  const sub = await getBrandSubscription(brandId)
  return currentProductCount < sub.features.maxProducts
}

/**
 * Get tier name for display
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  const names: Record<SubscriptionTier, string> = {
    free: 'Free',
    pro: 'Pro Analytics',
    enterprise: 'Enterprise',
  }
  return names[tier]
}

/**
 * Get tier description
 */
export function getTierDescription(tier: SubscriptionTier): string {
  const descriptions: Record<SubscriptionTier, string> = {
    free: 'Aggregate analytics and trends',
    pro: 'Individual feedback access, media playback, and exports',
    enterprise: 'Unlimited access with API and priority support',
  }
  return descriptions[tier]
}

/**
 * Get upgrade CTA based on missing feature
 */
export function getUpgradeCTA(feature: keyof TierFeatures): {
  title: string
  description: string
  minimumTier: SubscriptionTier
} {
  const ctas: Record<string, { title: string; description: string; minimumTier: SubscriptionTier }> = {
    canViewIndividual: {
      title: 'Upgrade to Pro to view individual feedback',
      description: 'Read full feedback text, transcripts, and user details',
      minimumTier: 'pro',
    },
    canPlayAudio: {
      title: 'Upgrade to Pro to play audio feedback',
      description: 'Listen to voice feedback from your customers',
      minimumTier: 'pro',
    },
    canPlayVideo: {
      title: 'Upgrade to Pro to watch video feedback',
      description: 'Watch video recordings submitted by customers',
      minimumTier: 'pro',
    },
    canExportCSV: {
      title: 'Upgrade to Pro to export data',
      description: 'Download all feedback as CSV for offline analysis',
      minimumTier: 'pro',
    },
    canAccessAPI: {
      title: 'Upgrade to Enterprise for API access',
      description: 'Integrate feedback data into your tools and workflows',
      minimumTier: 'enterprise',
    },
  }
  
  return ctas[feature] || {
    title: 'Upgrade for more features',
    description: 'Unlock advanced analytics and insights',
    minimumTier: 'pro',
  }
}
