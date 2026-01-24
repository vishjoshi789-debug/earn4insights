import 'server-only'
import { randomUUID } from 'crypto'
import type { Product } from '@/lib/types/product'
import type { WeeklyRanking, RankingEntry, RankedProduct } from '@/lib/types/ranking'
import type { ProductCategory } from '@/lib/categories'
import { CATEGORY_KEYS, getCategoryName } from '@/lib/categories'
import { getProducts } from '@/lib/product/store'
import { getAllResponses } from '@/lib/survey/responseStore'
import {
  calculateProductMetrics,
  calculateRankingScore,
  filterEligibleProducts,
  generateTopRankings,
} from './rankingEngine'
import {
  saveWeeklyRanking,
  getWeekStart,
  getWeekEnd,
  getCurrentRanking,
  getPreviousRank,
} from './rankingStore'
import { sendBulkRankingNotifications, type RankingEmailData } from '../emailNotifications'
import { sendBulkWhatsAppNotifications, type WhatsAppRankingData } from '../whatsappNotifications'

/**
 * Main service to generate weekly rankings
 * This is the core function called by cron job or admin trigger
 */
export async function generateWeeklyRankings(): Promise<{
  success: boolean
  rankings: WeeklyRanking[]
  errors: string[]
}> {
  const rankings: WeeklyRanking[] = []
  const errors: string[] = []

  console.log('🏆 Starting weekly ranking generation...')

  try {
    // Load all products and responses
    const allProducts = await getProducts()
    const allResponses = await getAllResponses()

    console.log(`📊 Loaded ${allProducts.length} products and ${allResponses.length} responses`)

    // Process each category
    for (const categoryKey of CATEGORY_KEYS) {
      try {
        const ranking = await generateCategoryRanking(
          categoryKey,
          allProducts,
          allResponses
        )

        if (ranking) {
          await saveWeeklyRanking(ranking)
          rankings.push(ranking)
          console.log(`✅ ${categoryKey}: Generated top ${ranking.rankings.length} products`)
        } else {
          console.log(`⚠️  ${categoryKey}: No eligible products`)
        }
      } catch (error) {
        const errorMsg = `Failed to generate ranking for ${categoryKey}: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    console.log(`🎉 Ranking generation complete! Generated ${rankings.length} category rankings`)

    // Send email and WhatsApp notifications
    // TODO: Re-enable notifications once Product type includes owner information
    // This requires associating products with user accounts in the database
    try {
      // Notifications disabled until owner info is properly tracked
      /*
      const emailData: RankingEmailData[] = []
      const whatsappData: WhatsAppRankingData[] = []
      
      for (const ranking of rankings) {
        for (const product of ranking.products) {
          // Get product details to find owner email
          const productDetails = allProducts.find(p => p.id === product.productId)
          const ownerEmail = productDetails?.profile?.data?.ownerEmail
          const ownerPhone = productDetails?.profile?.data?.ownerPhone
          const ownerName = productDetails?.profile?.data?.ownerName
          
          if (ownerEmail) {
            emailData.push({
              productName: product.productName,
              rank: ranking.products.indexOf(product) + 1,
              category: ranking.categoryName,
              previousRank: product.previousRank || undefined,
              score: product.rankingScore,
              ownerEmail,
              ownerName,
            })
          }

          if (ownerPhone) {
            whatsappData.push({
              productName: product.productName,
              rank: ranking.products.indexOf(product) + 1,
              category: ranking.categoryName,
              previousRank: product.previousRank || undefined,
              score: product.rankingScore,
              phoneNumber: ownerPhone,
              ownerName,
            })
          }
        }
      }

      if (emailData.length > 0) {
        console.log(`📧 Sending ${emailData.length} email notifications...`)
        const emailResults = await sendBulkRankingNotifications(emailData)
        console.log(`📧 Email notifications: ${emailResults.successful} sent, ${emailResults.failed} failed`)
      } else {
        console.log('⚠️ No owner emails found, skipping email notifications')
      }

      if (whatsappData.length > 0) {
        console.log(`📱 Sending ${whatsappData.length} WhatsApp notifications...`)
        const whatsappResults = await sendBulkWhatsAppNotifications(whatsappData)
        console.log(`📱 WhatsApp notifications: ${whatsappResults.successful} sent, ${whatsappResults.failed} failed`)
      } else {
        console.log('⚠️ No owner phone numbers found, skipping WhatsApp notifications')
      }
      */
      console.log('ℹ️ Ranking notifications disabled - owner information not yet implemented')
    } catch (error) {
      console.error('Failed to send notifications:', error)
      // Don't fail the whole operation if notifications fail
    }

    return {
      success: errors.length === 0,
      rankings,
      errors,
    }
  } catch (error) {
    const errorMsg = `Fatal error generating rankings: ${error}`
    console.error(errorMsg)
    return {
      success: false,
      rankings: [],
      errors: [errorMsg],
    }
  }
}

/**
 * Generate ranking for a specific category
 */
async function generateCategoryRanking(
  category: ProductCategory,
  allProducts: Product[],
  allResponses: any[]
): Promise<WeeklyRanking | null> {
  // Filter products by category
  const categoryProducts = allProducts.filter(p => 
    p.profile?.data?.category === category
  )

  if (categoryProducts.length === 0) {
    return null
  }

  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()

  // Calculate metrics for each product
  const metricsPromises = categoryProducts.map(async product => {
    const productResponses = allResponses.filter(r => r.productId === product.id)
    
    // Get previous week responses for trend calculation
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const previousWeekResponses = productResponses.filter(r => {
      const submittedAt = new Date(r.submittedAt)
      return submittedAt >= fourteenDaysAgo && submittedAt < sevenDaysAgo
    })

    return calculateProductMetrics(product, productResponses, previousWeekResponses)
  })

  const allMetrics = await Promise.all(metricsPromises)
  const validMetrics = allMetrics.filter(m => m !== null) as any[]

  // Filter eligible products (meet minimum thresholds)
  const eligibleMetrics = filterEligibleProducts(validMetrics)

  if (eligibleMetrics.length === 0) {
    return null
  }

  // Calculate scores
  const scores = eligibleMetrics.map(m => calculateRankingScore(m))

  // Generate top 10 rankings
  const top10 = generateTopRankings(scores, eligibleMetrics, 10)

  // Convert to ranking entries
  const rankings: RankingEntry[] = top10.map(item => ({
    rank: item.rank,
    productId: item.productId,
    productName: item.productName,
    score: item.score,
    metrics: {
      npsScore: item.metrics.npsScore,
      sentimentScore: item.metrics.sentimentScore,
      totalResponses: item.metrics.totalResponses,
      trendDirection: item.metrics.trendDirection,
      weekOverWeekChange: item.metrics.weekOverWeekChange,
    },
  }))

  const weeklyRanking: WeeklyRanking = {
    id: randomUUID(),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    category,
    categoryName: getCategoryName(category),
    rankings,
    products: top10.map(item => ({
      productId: item.productId,
      productName: item.productName,
      rankingScore: item.score,
      metrics: item.metrics,
      previousRank: null, // Will be populated below
    })),
    generatedAt: new Date().toISOString(),
    totalProductsEvaluated: categoryProducts.length,
  }

  // Add previous rank data
  for (const product of weeklyRanking.products) {
    const previousRank = await getPreviousRank(product.productId, category)
    product.previousRank = previousRank
  }

  return weeklyRanking
}

/**
 * Regenerate ranking for a specific category only
 */
export async function regenerateCategoryRanking(
  category: ProductCategory
): Promise<WeeklyRanking | null> {
  const allProducts = await getProducts()
  const allResponses = await getAllResponses()

  const ranking = await generateCategoryRanking(category, allProducts, allResponses)
  
  if (ranking) {
    await saveWeeklyRanking(ranking)
  }

  return ranking
}

/**
 * Get summary of current rankings across all categories
 */
export async function getRankingsSummary(): Promise<{
  totalCategories: number
  categoriesWithRankings: number
  totalRankedProducts: number
  lastGenerated: string | null
}> {
  const rankings = await Promise.all(
    CATEGORY_KEYS.map(cat => getCurrentRanking(cat))
  )

  const validRankings = rankings.filter(r => r !== null) as WeeklyRanking[]

  return {
    totalCategories: CATEGORY_KEYS.length,
    categoriesWithRankings: validRankings.length,
    totalRankedProducts: validRankings.reduce((sum, r) => sum + r.rankings.length, 0),
    lastGenerated: validRankings.length > 0
      ? validRankings.reduce((latest, r) => 
          new Date(r.generatedAt) > new Date(latest.generatedAt) ? r : latest
        ).generatedAt
      : null,
  }
}

/**
 * Check if product made it to top 10 (for notifications)
 */
export async function checkProductRankingChange(
  productId: string,
  category: ProductCategory
): Promise<{
  isInTop10: boolean
  currentRank: number | null
  previousRank: number | null
  isNewEntry: boolean
  rankChange: number | null
}> {
  const currentRanking = await getCurrentRanking(category)
  const previousRank = await getPreviousRank(productId, category)

  const currentEntry = currentRanking?.rankings.find(r => r.productId === productId)
  const currentRank = currentEntry?.rank || null

  const isInTop10 = currentRank !== null
  const isNewEntry = isInTop10 && previousRank === null
  const rankChange = currentRank && previousRank ? previousRank - currentRank : null

  return {
    isInTop10,
    currentRank,
    previousRank,
    isNewEntry,
    rankChange,
  }
}
