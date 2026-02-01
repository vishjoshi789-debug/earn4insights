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
 * Enhanced with granular demographic, cultural, and behavioral factors
 */
function calculateProductMatchScore(
  userProfile: {
    demographics?: any
    interests?: any
    behavioral?: any
    sensitiveData?: any
  },
  product: {
    id: string
    profile: any
  }
): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  const demographics = userProfile.demographics as any
  const userInterests = userProfile.interests as any
  const userBehavioral = userProfile.behavioral as any
  const sensitiveData = userProfile.sensitiveData as any
  const productCategory = product.profile?.category
  const productTargetAudience = product.profile?.targetAudience
  const productProfile = product.profile

  // 1. Category interest match (25% weight - reduced to make room for new factors)
  if (productCategory) {
    // Explicit interests (user-selected categories)
    const explicitInterests = userInterests?.productCategories || []
    if (explicitInterests.includes(productCategory)) {
      score += 25
      reasons.push(`Matches your interest in ${productCategory}`)
    }

    // Behavioral interests (learned from activity)
    const categoryInterests = userBehavioral?.categoryInterests || {}
    const behavioralScore = categoryInterests[productCategory] || 0
    score += behavioralScore * 15 // Up to 15 points
    if (behavioralScore > 0.5) {
      reasons.push(`Based on your activity in ${productCategory}`)
    }
  }

  // 2. Demographics match (25% weight - enhanced)
  
  // Age range matching (8 points)
  if (demographics?.ageRange && productTargetAudience?.ageRanges) {
    if (productTargetAudience.ageRanges.includes(demographics.ageRange)) {
      score += 8
      reasons.push('Perfect fit for your age group')
    }
  }

  // Gender matching (7 points)
  if (demographics?.gender && productTargetAudience?.genders) {
    if (productTargetAudience.genders.includes(demographics.gender) || 
        productTargetAudience.genders.includes('all')) {
      score += 7
      reasons.push('Designed for your demographic')
    }
  }

  // Education level matching (5 points)
  if (demographics?.education && productTargetAudience?.educationLevels) {
    if (productTargetAudience.educationLevels.includes(demographics.education)) {
      score += 5
      reasons.push('Matches your educational background')
    }
  }

  // Location/Region matching (5 points)
  if (demographics?.location && productTargetAudience?.locations) {
    if (productTargetAudience.locations.includes(demographics.location)) {
      score += 5
      reasons.push('Available in your region')
    }
  }

  // 3. Cultural & Lifestyle match (15% weight - NEW)
  
  // Cultural preferences matching (8 points)
  if (demographics?.culture && productProfile?.culturalRelevance) {
    const culturalMatch = productProfile.culturalRelevance[demographics.culture]
    if (culturalMatch === 'high') {
      score += 8
      reasons.push(`Culturally relevant to ${demographics.culture} consumers`)
    } else if (culturalMatch === 'medium') {
      score += 4
    }
  }

  // Aspirations matching (7 points)
  if (demographics?.aspirations && productProfile?.aspirationAlignment) {
    const userAspirations = demographics.aspirations || []
    const productAspirations = productProfile.aspirationAlignment || []
    
    const matchingAspirations = userAspirations.filter((asp: string) => 
      productAspirations.includes(asp)
    )
    
    if (matchingAspirations.length > 0) {
      const aspirationScore = Math.min((matchingAspirations.length / userAspirations.length) * 7, 7)
      score += aspirationScore
      if (matchingAspirations.length > 0) {
        reasons.push(`Aligns with your ${matchingAspirations[0]} goals`)
      }
    }
  }

  // 4. Income capacity & value matching (15% weight - NEW, privacy-protected)
  if (sensitiveData?.incomeRange && productProfile?.priceSegment) {
    const incomeSegmentMatch: Record<string, string[]> = {
      'budget': ['0-25k', '25k-50k'],
      'mid-range': ['25k-50k', '50k-100k', '100k-200k'],
      'premium': ['100k-200k', '200k+'],
      'luxury': ['200k+']
    }
    
    const matchingSegments = incomeSegmentMatch[productProfile.priceSegment] || []
    if (matchingSegments.includes(sensitiveData.incomeRange)) {
      score += 15
      reasons.push('Fits your budget preferences')
    } else if (productProfile.priceSegment === 'budget') {
      // Budget products get small bonus for value-conscious users
      score += 3
    }
  }

  // 5. Purchase behavior & platform history (10% weight - NEW)
  if (sensitiveData?.purchaseHistory) {
    const purchaseHistory = sensitiveData.purchaseHistory
    
    // Amazon purchase history matching
    if (purchaseHistory.amazonCategories && productCategory) {
      if (purchaseHistory.amazonCategories.includes(productCategory)) {
        score += 5
        reasons.push('You\'ve bought similar products on Amazon')
      }
    }
    
    // Purchase frequency matching
    if (purchaseHistory.frequency && productProfile?.targetFrequency) {
      if (purchaseHistory.frequency === productProfile.targetFrequency) {
        score += 3
        reasons.push('Matches your shopping habits')
      }
    }
    
    // Brand loyalty signal
    if (purchaseHistory.preferredBrands && productProfile?.brandType) {
      if (purchaseHistory.preferredBrands.includes(productProfile.brandType)) {
        score += 2
      }
    }
  }

  // 6. Engagement level (10% weight)
  const engagementScore = userBehavioral?.engagementScore || 0
  if (engagementScore > 10) {
    score += 10
    reasons.push('High engagement - premium recommendation')
  } else if (engagementScore > 5) {
    score += 5
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
