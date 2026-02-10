/**
 * Unified Analytics Service
 * 
 * Aggregates feedback from multiple sources (surveys, direct feedback, future: reviews, social)
 * into a single analytics view for brands.
 * 
 * Architecture inspired by:
 * - Intercom (multi-channel inbox)
 * - Amplitude (cross-source event aggregation)
 * - Zendesk (unified support analytics)
 * 
 * Design Principles:
 * 1. Source abstraction - each source implements IFeedbackSource
 * 2. Lazy loading - fetch only what's needed
 * 3. Type-safe - full TypeScript support
 * 4. Extensible - easy to add new sources
 * 5. Cost-optimized - efficient queries
 */

import 'server-only'
import { db } from '@/db'
import { surveyResponses, feedback, feedbackMedia } from '@/db/schema'
import { eq, and, gte, lte, inArray, sql, or } from 'drizzle-orm'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Unified feedback item - normalized representation across all sources
 */
export interface UnifiedFeedbackItem {
  id: string
  source: 'survey' | 'feedback' | 'review' | 'social' // Extensible for future
  sourceId: string // Original ID from source table
  
  // Core fields (common across all sources)
  productId: string
  createdAt: Date
  
  // User info
  userName?: string
  userEmail?: string
  
  // Content
  text: string // Normalized text (preferred) or original
  originalText?: string // If normalization happened
  
  // Multimodal
  modality: 'text' | 'audio' | 'video' | 'image' | 'mixed'
  hasAudio: boolean
  hasVideo: boolean
  hasImages: boolean
  mediaCount: number
  
  // Multilingual
  originalLanguage?: string
  normalizedLanguage?: string
  
  // Sentiment
  sentiment?: 'positive' | 'neutral' | 'negative'
  
  // Rating (if applicable)
  rating?: number // NPS (0-10), star rating (1-5), etc.
  
  // Processing
  processingStatus: 'ready' | 'processing' | 'failed'
  
  // Source-specific metadata
  metadata: {
    surveyId?: string
    surveyTitle?: string
    surveyType?: string
    feedbackCategory?: string
    [key: string]: any
  }
}

/**
 * Aggregated metrics across all feedback sources
 */
export interface UnifiedMetrics {
  // Volume
  totalFeedback: number
  bySource: {
    survey: number
    feedback: number
    review: number
    social: number
  }
  
  // Modality distribution
  byModality: {
    text: number
    audio: number
    video: number
    image: number
    mixed: number
  }
  
  // Sentiment distribution
  bySentiment: {
    positive: number
    neutral: number
    negative: number
    unknown: number
  }
  
  // Language distribution
  byLanguage: Array<{
    language: string
    count: number
    percentage: number
  }>
  
  // Ratings (if applicable)
  averageRating?: number
  ratingDistribution?: Array<{
    rating: number
    count: number
  }>
  
  // NPS-specific (for surveys)
  nps?: {
    score: number
    promoters: number
    passives: number
    detractors: number
    totalResponses: number
  }
  
  // Processing health
  processingMetrics: {
    ready: number
    processing: number
    failed: number
    successRate: number
  }
}

/**
 * Filter options for querying unified analytics
 */
export interface UnifiedAnalyticsFilters {
  // Entity filters
  productId?: string
  productIds?: string[]
  brandId?: string
  categoryId?: string
  
  // Source filters
  sources?: Array<'survey' | 'feedback' | 'review' | 'social'>
  
  // Time filters
  dateFrom?: Date
  dateTo?: Date
  
  // Content filters
  modalities?: Array<'text' | 'audio' | 'video' | 'image' | 'mixed'>
  sentiments?: Array<'positive' | 'neutral' | 'negative'>
  languages?: string[]
  
  // Rating filters
  ratingMin?: number
  ratingMax?: number
  
  // Processing filters
  processingStatus?: Array<'ready' | 'processing' | 'failed'>
  
  // Pagination
  limit?: number
  offset?: number
  
  // Sorting
  sortBy?: 'createdAt' | 'rating' | 'sentiment'
  sortOrder?: 'asc' | 'desc'
}

// ============================================================================
// SOURCE ABSTRACTION LAYER
// ============================================================================

/**
 * Interface that each feedback source must implement
 * Makes it easy to add new sources (reviews, social listening, etc.)
 */
interface IFeedbackSource {
  /**
   * Fetch feedback items from this source
   */
  fetchItems(filters: UnifiedAnalyticsFilters): Promise<UnifiedFeedbackItem[]>
  
  /**
   * Calculate metrics for this source
   */
  calculateMetrics(filters: UnifiedAnalyticsFilters): Promise<Partial<UnifiedMetrics>>
}

/**
 * Survey Response Source
 * Aggregates data from survey_responses table
 */
class SurveyResponseSource implements IFeedbackSource {
  async fetchItems(filters: UnifiedAnalyticsFilters): Promise<UnifiedFeedbackItem[]> {
    const conditions: any[] = []
    
    // Apply filters
    if (filters.productId) {
      conditions.push(eq(surveyResponses.productId, filters.productId))
    }
    if (filters.productIds && filters.productIds.length > 0) {
      conditions.push(inArray(surveyResponses.productId, filters.productIds))
    }
    if (filters.dateFrom) {
      conditions.push(gte(surveyResponses.submittedAt, filters.dateFrom))
    }
    if (filters.dateTo) {
      conditions.push(lte(surveyResponses.submittedAt, filters.dateTo))
    }
    if (filters.sentiments && filters.sentiments.length > 0) {
      conditions.push(inArray(surveyResponses.sentiment, filters.sentiments))
    }
    if (filters.modalities && filters.modalities.length > 0) {
      conditions.push(inArray(surveyResponses.modalityPrimary, filters.modalities))
    }
    if (filters.languages && filters.languages.length > 0) {
      conditions.push(inArray(surveyResponses.originalLanguage, filters.languages))
    }
    if (filters.processingStatus && filters.processingStatus.length > 0) {
      conditions.push(inArray(surveyResponses.processingStatus, filters.processingStatus))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    
    // Fetch responses
    const responses = await db
      .select()
      .from(surveyResponses)
      .where(whereClause)
      .limit(filters.limit || 100)
      .offset(filters.offset || 0)
      .orderBy(
        filters.sortOrder === 'asc' 
          ? surveyResponses.submittedAt 
          : sql`${surveyResponses.submittedAt} DESC`
      )
    
    // Fetch media counts for each response
    const responseIds = responses.map(r => r.id)
    const mediaItems = responseIds.length > 0 
      ? await db
          .select()
          .from(feedbackMedia)
          .where(
            and(
              eq(feedbackMedia.ownerType, 'survey_response'),
              inArray(feedbackMedia.ownerId, responseIds)
            )
          )
      : []
    
    // Group media by response
    const mediaByResponse = mediaItems.reduce<Record<string, typeof mediaItems>>((acc, item) => {
      if (!acc[item.ownerId]) acc[item.ownerId] = []
      acc[item.ownerId].push(item)
      return acc
    }, {})
    
    // Transform to unified format
    return responses.map(response => {
      const media = mediaByResponse[response.id] || []
      const hasAudio = media.some(m => String(m.mediaType) === 'audio')
      const hasVideo = media.some(m => String(m.mediaType) === 'video')
      const hasImages = media.some(m => String(m.mediaType) === 'image')
      
      return {
        id: response.id,
        source: 'survey' as const,
        sourceId: response.id,
        productId: response.productId,
        createdAt: new Date(response.submittedAt),
        userName: response.userName || undefined,
        userEmail: response.userEmail || undefined,
        text: response.normalizedText || response.transcriptText || '',
        originalText: response.normalizedText ? (response.transcriptText ?? undefined) : undefined,
        modality: (response.modalityPrimary || 'text') as any,
        hasAudio,
        hasVideo,
        hasImages,
        mediaCount: media.length,
        originalLanguage: response.originalLanguage || undefined,
        normalizedLanguage: response.normalizedLanguage || undefined,
        sentiment: response.sentiment as any,
        rating: response.npsScore || undefined,
        processingStatus: (response.processingStatus || 'ready') as any,
        metadata: {
          surveyId: response.surveyId,
          // Survey title/type would need a join - optimization for later
        },
      }
    })
  }
  
  async calculateMetrics(filters: UnifiedAnalyticsFilters): Promise<Partial<UnifiedMetrics>> {
    const conditions: any[] = []
    
    // Apply filters (same as fetchItems)
    if (filters.productId) {
      conditions.push(eq(surveyResponses.productId, filters.productId))
    }
    if (filters.productIds && filters.productIds.length > 0) {
      conditions.push(inArray(surveyResponses.productId, filters.productIds))
    }
    if (filters.dateFrom) {
      conditions.push(gte(surveyResponses.submittedAt, filters.dateFrom))
    }
    if (filters.dateTo) {
      conditions.push(lte(surveyResponses.submittedAt, filters.dateTo))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    
    try {
      // Single aggregation query for efficiency
      const result = await db
        .select({
          total: sql<number>`count(*)::int`,
          modalityText: sql<number>`count(*) FILTER (WHERE modality_primary = 'text')::int`,
          modalityAudio: sql<number>`count(*) FILTER (WHERE modality_primary = 'audio')::int`,
          modalityVideo: sql<number>`count(*) FILTER (WHERE modality_primary = 'video')::int`,
          modalityImage: sql<number>`count(*) FILTER (WHERE modality_primary = 'image')::int`,
          modalityMixed: sql<number>`count(*) FILTER (WHERE modality_primary = 'mixed')::int`,
          sentimentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
          sentimentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
          sentimentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
          sentimentUnknown: sql<number>`count(*) FILTER (WHERE sentiment IS NULL OR sentiment = '')::int`,
          processingReady: sql<number>`count(*) FILTER (WHERE processing_status = 'ready')::int`,
          processingProcessing: sql<number>`count(*) FILTER (WHERE processing_status = 'processing')::int`,
          processingFailed: sql<number>`count(*) FILTER (WHERE processing_status = 'failed')::int`,
        })
        .from(surveyResponses)
        .where(whereClause)
      
      const data = result[0] || {}
      
      const total = data.total || 0
      const processed = (data.processingReady || 0) + (data.processingFailed || 0)
      const successRate = processed > 0 ? ((data.processingReady || 0) / processed) * 100 : 0
      
      return {
        totalFeedback: total,
        bySource: {
          survey: total,
          feedback: 0,
          review: 0,
          social: 0,
        },
        byModality: {
          text: data.modalityText || 0,
          audio: data.modalityAudio || 0,
          video: data.modalityVideo || 0,
          image: data.modalityImage || 0,
          mixed: data.modalityMixed || 0,
        },
        bySentiment: {
          positive: data.sentimentPositive || 0,
          neutral: data.sentimentNeutral || 0,
          negative: data.sentimentNegative || 0,
          unknown: data.sentimentUnknown || 0,
        },
        processingMetrics: {
        ready: data.processingReady || 0,
        processing: data.processingProcessing || 0,
        failed: data.processingFailed || 0,
        successRate,
      },
    }
    } catch {
      // Fallback if modality_primary/processing_status columns don't exist
      const result = await db
        .select({
          total: sql<number>`count(*)::int`,
          sentimentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
          sentimentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
          sentimentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
        })
        .from(surveyResponses)
        .where(whereClause)
      
      const data = result[0] || {}
      const total = data.total || 0
      
      return {
        totalFeedback: total,
        bySource: { survey: total, feedback: 0, review: 0, social: 0 },
        byModality: { text: total, audio: 0, video: 0, image: 0, mixed: 0 },
        bySentiment: {
          positive: data.sentimentPositive || 0,
          neutral: data.sentimentNeutral || 0,
          negative: data.sentimentNegative || 0,
          unknown: 0,
        },
        processingMetrics: { ready: total, processing: 0, failed: 0, successRate: 100 },
      }
    }
  }
}

/**
 * Direct Feedback Source
 * Aggregates data from feedback table
 */
class DirectFeedbackSource implements IFeedbackSource {
  async fetchItems(filters: UnifiedAnalyticsFilters): Promise<UnifiedFeedbackItem[]> {
    const conditions: any[] = []
    
    // Apply filters
    if (filters.productId) {
      conditions.push(eq(feedback.productId, filters.productId))
    }
    if (filters.productIds && filters.productIds.length > 0) {
      conditions.push(inArray(feedback.productId, filters.productIds))
    }
    if (filters.dateFrom) {
      conditions.push(gte(feedback.createdAt, filters.dateFrom))
    }
    if (filters.dateTo) {
      conditions.push(lte(feedback.createdAt, filters.dateTo))
    }
    if (filters.sentiments && filters.sentiments.length > 0) {
      conditions.push(inArray(feedback.sentiment, filters.sentiments))
    }
    if (filters.modalities && filters.modalities.length > 0) {
      conditions.push(inArray(feedback.modalityPrimary, filters.modalities))
    }
    if (filters.ratingMin !== undefined) {
      conditions.push(gte(feedback.rating, filters.ratingMin))
    }
    if (filters.ratingMax !== undefined) {
      conditions.push(lte(feedback.rating, filters.ratingMax))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    
    // Fetch feedback items
    const items = await db
      .select()
      .from(feedback)
      .where(whereClause)
      .limit(filters.limit || 100)
      .offset(filters.offset || 0)
      .orderBy(
        filters.sortOrder === 'asc' 
          ? feedback.createdAt 
          : sql`${feedback.createdAt} DESC`
      )
    
    // Fetch media counts
    const itemIds = items.map(r => r.id)
    const mediaItems = itemIds.length > 0 
      ? await db
          .select()
          .from(feedbackMedia)
          .where(
            and(
              eq(feedbackMedia.ownerType, 'feedback'),
              inArray(feedbackMedia.ownerId, itemIds)
            )
          )
      : []
    
    const mediaByItem = mediaItems.reduce<Record<string, typeof mediaItems>>((acc, item) => {
      if (!acc[item.ownerId]) acc[item.ownerId] = []
      acc[item.ownerId].push(item)
      return acc
    }, {})
    
    // Transform to unified format
    return items.map(item => {
      const media = mediaByItem[item.id] || []
      const hasAudio = media.some(m => String(m.mediaType) === 'audio')
      const hasVideo = media.some(m => String(m.mediaType) === 'video')
      const hasImages = media.some(m => String(m.mediaType) === 'image')
      
      return {
        id: item.id,
        source: 'feedback' as const,
        sourceId: item.id,
        productId: item.productId,
        createdAt: new Date(item.createdAt),
        userName: item.userName || undefined,
        userEmail: item.userEmail || undefined,
        text: item.normalizedText || item.feedbackText || '',
        originalText: item.normalizedText ? item.feedbackText : undefined,
        modality: (item.modalityPrimary || 'text') as any,
        hasAudio,
        hasVideo,
        hasImages,
        mediaCount: media.length,
        originalLanguage: item.originalLanguage || undefined,
        normalizedLanguage: item.normalizedLanguage || undefined,
        sentiment: item.sentiment as any,
        rating: item.rating || undefined,
        processingStatus: (item.processingStatus || 'ready') as any,
        metadata: {
          feedbackCategory: item.category || undefined,
        },
      }
    })
  }
  
  async calculateMetrics(filters: UnifiedAnalyticsFilters): Promise<Partial<UnifiedMetrics>> {
    const conditions: any[] = []
    
    // Apply filters
    if (filters.productId) {
      conditions.push(eq(feedback.productId, filters.productId))
    }
    if (filters.productIds && filters.productIds.length > 0) {
      conditions.push(inArray(feedback.productId, filters.productIds))
    }
    if (filters.dateFrom) {
      conditions.push(gte(feedback.createdAt, filters.dateFrom))
    }
    if (filters.dateTo) {
      conditions.push(lte(feedback.createdAt, filters.dateTo))
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined
    
    try {
      // Aggregation query
      const result = await db
        .select({
          total: sql<number>`count(*)::int`,
          modalityText: sql<number>`count(*) FILTER (WHERE modality_primary = 'text')::int`,
          modalityAudio: sql<number>`count(*) FILTER (WHERE modality_primary = 'audio')::int`,
          modalityVideo: sql<number>`count(*) FILTER (WHERE modality_primary = 'video')::int`,
          modalityImage: sql<number>`count(*) FILTER (WHERE modality_primary = 'image')::int`,
          modalityMixed: sql<number>`count(*) FILTER (WHERE modality_primary = 'mixed')::int`,
          sentimentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
          sentimentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
          sentimentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
          sentimentUnknown: sql<number>`count(*) FILTER (WHERE sentiment IS NULL OR sentiment = '')::int`,
          processingReady: sql<number>`count(*) FILTER (WHERE processing_status = 'ready')::int`,
          processingProcessing: sql<number>`count(*) FILTER (WHERE processing_status = 'processing')::int`,
          processingFailed: sql<number>`count(*) FILTER (WHERE processing_status = 'failed')::int`,
          avgRating: sql<number>`AVG(rating)::float`,
        })
        .from(feedback)
        .where(whereClause)
      
      const data = result[0] || {}
      
      const total = data.total || 0
      const processed = (data.processingReady || 0) + (data.processingFailed || 0)
      const successRate = processed > 0 ? ((data.processingReady || 0) / processed) * 100 : 0
      
      return {
        totalFeedback: total,
        bySource: {
          survey: 0,
          feedback: total,
          review: 0,
          social: 0,
        },
        byModality: {
          text: data.modalityText || 0,
          audio: data.modalityAudio || 0,
          video: data.modalityVideo || 0,
          image: data.modalityImage || 0,
          mixed: data.modalityMixed || 0,
        },
        bySentiment: {
          positive: data.sentimentPositive || 0,
          neutral: data.sentimentNeutral || 0,
          negative: data.sentimentNegative || 0,
          unknown: data.sentimentUnknown || 0,
        },
        averageRating: data.avgRating || undefined,
        processingMetrics: {
          ready: data.processingReady || 0,
          processing: data.processingProcessing || 0,
          failed: data.processingFailed || 0,
          successRate,
        },
      }
    } catch {
      // Fallback if modality_primary/processing_status columns don't exist
      const result = await db
        .select({
          total: sql<number>`count(*)::int`,
          sentimentPositive: sql<number>`count(*) FILTER (WHERE sentiment = 'positive')::int`,
          sentimentNeutral: sql<number>`count(*) FILTER (WHERE sentiment = 'neutral')::int`,
          sentimentNegative: sql<number>`count(*) FILTER (WHERE sentiment = 'negative')::int`,
          avgRating: sql<number>`AVG(rating)::float`,
        })
        .from(feedback)
        .where(whereClause)
      
      const data = result[0] || {}
      const total = data.total || 0
      
      return {
        totalFeedback: total,
        bySource: { survey: 0, feedback: total, review: 0, social: 0 },
        byModality: { text: total, audio: 0, video: 0, image: 0, mixed: 0 },
        bySentiment: {
          positive: data.sentimentPositive || 0,
          neutral: data.sentimentNeutral || 0,
          negative: data.sentimentNegative || 0,
          unknown: 0,
        },
        averageRating: data.avgRating || undefined,
        processingMetrics: { ready: total, processing: 0, failed: 0, successRate: 100 },
      }
    }
  }
}

// ============================================================================
// UNIFIED ANALYTICS SERVICE
// ============================================================================

/**
 * Main service for unified analytics
 * Aggregates data from all feedback sources
 */
export class UnifiedAnalyticsService {
  private sources: IFeedbackSource[] = [
    new SurveyResponseSource(),
    new DirectFeedbackSource(),
    // Easy to add new sources:
    // new ReviewSource(),
    // new SocialListeningSource(),
  ]
  
  /**
   * Fetch unified feedback items from all sources
   */
  async fetchFeedbackItems(filters: UnifiedAnalyticsFilters): Promise<UnifiedFeedbackItem[]> {
    // Filter which sources to query
    const activeSources = filters.sources 
      ? this.sources.filter(s => {
          if (s instanceof SurveyResponseSource) return filters.sources?.includes('survey')
          if (s instanceof DirectFeedbackSource) return filters.sources?.includes('feedback')
          return false
        })
      : this.sources
    
    // Fetch from all sources in parallel (cost-optimized)
    const results = await Promise.all(
      activeSources.map(async source => {
        try {
          return await source.fetchItems(filters)
        } catch (err) {
          console.error('[UnifiedAnalytics] Source fetch error (likely missing columns):', err)
          return [] // Gracefully return empty if source fails
        }
      })
    )
    
    // Flatten and sort
    const allItems = results.flat()
    allItems.sort((a, b) => {
      if (filters.sortOrder === 'asc') {
        return a.createdAt.getTime() - b.createdAt.getTime()
      }
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    
    // Apply global limit
    const limit = filters.limit || 100
    return allItems.slice(0, limit)
  }
  
  /**
   * Calculate unified metrics across all sources
   */
  async calculateUnifiedMetrics(filters: UnifiedAnalyticsFilters): Promise<UnifiedMetrics> {
    // Filter which sources to query
    const activeSources = filters.sources 
      ? this.sources.filter(s => {
          if (s instanceof SurveyResponseSource) return filters.sources?.includes('survey')
          if (s instanceof DirectFeedbackSource) return filters.sources?.includes('feedback')
          return false
        })
      : this.sources
    
    // Calculate metrics from all sources in parallel
    const results = await Promise.all(
      activeSources.map(async source => {
        try {
          return await source.calculateMetrics(filters)
        } catch (err) {
          console.error('[UnifiedAnalytics] Metrics calculation error:', err)
          return {} as Partial<UnifiedMetrics>
        }
      })
    )
    
    // Merge metrics
    const merged: UnifiedMetrics = {
      totalFeedback: 0,
      bySource: { survey: 0, feedback: 0, review: 0, social: 0 },
      byModality: { text: 0, audio: 0, video: 0, image: 0, mixed: 0 },
      bySentiment: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
      byLanguage: [],
      processingMetrics: { ready: 0, processing: 0, failed: 0, successRate: 0 },
    }
    
    let totalRatings = 0
    let sumRatings = 0
    
    for (const result of results) {
      merged.totalFeedback += result.totalFeedback || 0
      
      if (result.bySource) {
        merged.bySource.survey += result.bySource.survey || 0
        merged.bySource.feedback += result.bySource.feedback || 0
        merged.bySource.review += result.bySource.review || 0
        merged.bySource.social += result.bySource.social || 0
      }
      
      if (result.byModality) {
        merged.byModality.text += result.byModality.text || 0
        merged.byModality.audio += result.byModality.audio || 0
        merged.byModality.video += result.byModality.video || 0
        merged.byModality.image += result.byModality.image || 0
        merged.byModality.mixed += result.byModality.mixed || 0
      }
      
      if (result.bySentiment) {
        merged.bySentiment.positive += result.bySentiment.positive || 0
        merged.bySentiment.neutral += result.bySentiment.neutral || 0
        merged.bySentiment.negative += result.bySentiment.negative || 0
        merged.bySentiment.unknown += result.bySentiment.unknown || 0
      }
      
      if (result.processingMetrics) {
        merged.processingMetrics.ready += result.processingMetrics.ready || 0
        merged.processingMetrics.processing += result.processingMetrics.processing || 0
        merged.processingMetrics.failed += result.processingMetrics.failed || 0
      }
      
      if (result.averageRating) {
        sumRatings += result.averageRating * (result.totalFeedback || 0)
        totalRatings += result.totalFeedback || 0
      }
    }
    
    // Calculate combined metrics
    const processed = merged.processingMetrics.ready + merged.processingMetrics.failed
    merged.processingMetrics.successRate = processed > 0 
      ? (merged.processingMetrics.ready / processed) * 100 
      : 0
    
    if (totalRatings > 0) {
      merged.averageRating = sumRatings / totalRatings
    }
    
    return merged
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

const service = new UnifiedAnalyticsService()

/**
 * Get unified feedback for a product
 */
export async function getUnifiedFeedback(
  productId: string,
  filters?: Partial<UnifiedAnalyticsFilters>
): Promise<UnifiedFeedbackItem[]> {
  return service.fetchFeedbackItems({
    productId,
    ...filters,
  })
}

/**
 * Get unified metrics for a product
 */
export async function getUnifiedMetrics(
  productId: string,
  filters?: Partial<UnifiedAnalyticsFilters>
): Promise<UnifiedMetrics> {
  return service.calculateUnifiedMetrics({
    productId,
    ...filters,
  })
}

/**
 * Get unified feedback for multiple products (brand-level)
 */
export async function getUnifiedFeedbackForBrand(
  productIds: string[],
  filters?: Partial<UnifiedAnalyticsFilters>
): Promise<UnifiedFeedbackItem[]> {
  return service.fetchFeedbackItems({
    productIds,
    ...filters,
  })
}

/**
 * Get unified metrics for multiple products (brand-level)
 */
export async function getUnifiedMetricsForBrand(
  productIds: string[],
  filters?: Partial<UnifiedAnalyticsFilters>
): Promise<UnifiedMetrics> {
  return service.calculateUnifiedMetrics({
    productIds,
    ...filters,
  })
}
