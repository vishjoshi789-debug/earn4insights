import { db } from '@/db'
import { userProfiles, products } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getUserEventCounts, calculateCategoryInterests } from './analyticsService'

/**
 * Personalization Engine
 * Generates personalized product recommendations based on user profile and behavior
 */

export type RecommendationScore = {
  productId: string
  score: number
  reasons: string[]
}

/**
 * Calculate match score between user and product
 */
function calculateProductMatchScore(
  userProfile: {
    demographics?: any
    interests?: any
    behavioral?: any
  },
  product: {
    id: string
    profile: any
  }
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // 1. Category interest match (40% weight)
  const userInterests = userProfile.interests as any
  const userBehavioral = userProfile.behavioral as any
  const productCategory = product.profile?.category

  if (productCategory) {
    // Explicit interests (user-selected categories)
    const explicitInterests = userInterests?.productCategories || []
    if (explicitInterests.includes(productCategory)) {
      score += 40
      reasons.push(`Matches your interest in ${productCategory}`)
    }

    // Behavioral interests (learned from activity)
    const categoryInterests = userBehavioral?.categoryInterests || {}
    const behavioralScore = categoryInterests[productCategory] || 0
    score += behavioralScore * 30 // Up to 30 points
    if (behavioralScore > 0.5) {
      reasons.push(`Based on your activity in ${productCategory}`)
    }
  }

  // 2. Engagement level (20% weight)
  const engagementScore = userBehavioral?.engagementScore || 0
  if (engagementScore > 10) {
    score += 20
    reasons.push('High engagement user - premium recommendation')
  } else if (engagementScore > 5) {
    score += 10
  }

  // 3. Demographics match (10% weight)
  const demographics = userProfile.demographics as any
  const productTargetAudience = product.profile?.targetAudience

  if (demographics?.ageRange && productTargetAudience?.ageRanges) {
    if (productTargetAudience.ageRanges.includes(demographics.ageRange)) {
      score += 10
      reasons.push('Matches your age group')
    }
  }

  if (demographics?.location && productTargetAudience?.locations) {
    if (productTargetAudience.locations.includes(demographics.location)) {
      score += 5
      reasons.push('Available in your location')
    }
  }

  return { score, reasons }
}

/**
 * Get personalized product recommendations for a user
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 10
): Promise<RecommendationScore[]> {
  // Get user profile
  const userProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!userProfile[0]) {
    throw new Error('User profile not found')
  }

  const profile = userProfile[0]

  // Get all active products
  const allProducts = await db
    .select()
    .from(products)

  // Calculate scores for each product
  const scoredProducts = allProducts.map(product => {
    const { score, reasons } = calculateProductMatchScore(profile, product)
    return {
      productId: product.id,
      score,
      reasons
    }
  })

  // Sort by score and return top N
  return scoredProducts
    .filter(p => p.score > 0) // Only return products with some match
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Get similar users based on interests and behavior
 */
export async function getSimilarUsers(
  userId: string,
  limit: number = 10
): Promise<string[]> {
  const userProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!userProfile[0]) return []

  const targetInterests = (userProfile[0].interests as any)?.productCategories || []
  if (targetInterests.length === 0) return []

  // Find users with overlapping interests
  const similarUsers = await db
    .select({
      id: userProfiles.id,
      interests: userProfiles.interests
    })
    .from(userProfiles)
    .where(sql`${userProfiles.id} != ${userId}`)

  // Calculate similarity scores
  const scored = similarUsers.map(user => {
    const theirInterests = (user.interests as any)?.productCategories || []
    const overlap = targetInterests.filter((cat: string) => theirInterests.includes(cat)).length
    const similarity = overlap / Math.max(targetInterests.length, theirInterests.length)
    
    return { userId: user.id, similarity }
  })

  return scored
    .filter(s => s.similarity > 0.3) // At least 30% overlap
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(s => s.userId)
}

/**
 * Get recommended surveys for a user
 * Based on their interests and products they've viewed
 */
export async function getRecommendedSurveys(
  userId: string,
  limit: number = 5
): Promise<string[]> {
  // Get user's category interests
  const categoryInterests = await calculateCategoryInterests(userId)
  const topCategories = Object.entries(categoryInterests)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat)

  if (topCategories.length === 0) {
    // No behavioral data, use explicit interests
    const userProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (userProfile[0]) {
      const explicitInterests = (userProfile[0].interests as any)?.productCategories || []
      topCategories.push(...explicitInterests.slice(0, 3))
    }
  }

  // Find products in those categories that have surveys
  // This is a simplified version - in production you'd join with surveys table
  const recommendedProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(sql`${products.profile}->>'category' = ANY(${topCategories})`)
    .limit(limit)

  return recommendedProducts.map(p => p.id)
}

/**
 * Explain why a product is recommended
 */
export async function explainRecommendation(
  userId: string,
  productId: string
): Promise<{ score: number; reasons: string[] }> {
  const userProfile = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!userProfile[0]) {
    return { score: 0, reasons: ['User profile not found'] }
  }

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  if (!product[0]) {
    return { score: 0, reasons: ['Product not found'] }
  }

  return calculateProductMatchScore(userProfile[0], product[0])
}
