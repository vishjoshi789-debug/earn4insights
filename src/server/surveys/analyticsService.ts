import 'server-only'
import { db } from '@/db'
import { surveyResponses, feedbackMedia } from '@/db/schema'
import { eq, and, gte, lte, isNotNull, sql } from 'drizzle-orm'

export interface ModalityMetrics {
  text: number
  audio: number
  video: number
  image: number
  mixed: number
  total: number
}

export interface SentimentMetrics {
  positive: number
  neutral: number
  negative: number
  unknown: number
  total: number
  byModality: {
    text: { positive: number; neutral: number; negative: number }
    audio: { positive: number; neutral: number; negative: number }
    video: { positive: number; neutral: number; negative: number }
    image: { positive: number; neutral: number; negative: number }
  }
}

export interface LanguageMetrics {
  distribution: Array<{ language: string; count: number; percentage: number }>
  topLanguages: Array<{ language: string; count: number }>
  totalWithLanguage: number
  totalResponses: number
}

export interface ProcessingMetrics {
  audio: {
    total: number
    uploaded: number
    processing: number
    ready: number
    failed: number
    deleted: number
    successRate: number
  }
  video: {
    total: number
    uploaded: number
    processing: number
    ready: number
    failed: number
    deleted: number
    successRate: number
  }
  image: {
    total: number
  }
}

export interface MultimodalAnalytics {
  modalityMetrics: ModalityMetrics
  sentimentMetrics: SentimentMetrics
  languageMetrics: LanguageMetrics
  processingMetrics: ProcessingMetrics
  totalResponses: number
  dateRange?: { from: Date; to: Date }
}

export async function calculateMultimodalAnalytics(params: {
  surveyId: string
  dateFrom?: Date
  dateTo?: Date
}): Promise<MultimodalAnalytics> {
  const { surveyId, dateFrom, dateTo } = params

  // Build base conditions
  const conditions = [eq(surveyResponses.surveyId, surveyId)]
  if (dateFrom) conditions.push(gte(surveyResponses.createdAt, dateFrom))
  if (dateTo) conditions.push(lte(surveyResponses.createdAt, dateTo))

  // Fetch all responses for the survey
  const responses = await db
    .select({
      id: surveyResponses.id,
      modalityPrimary: surveyResponses.modalityPrimary,
      sentiment: surveyResponses.sentiment,
      originalLanguage: surveyResponses.originalLanguage,
      createdAt: surveyResponses.createdAt,
    })
    .from(surveyResponses)
    .where(and(...conditions))

  const totalResponses = responses.length

  // Calculate modality metrics
  const modalityCounts = responses.reduce(
    (acc, r) => {
      const modality = (r.modalityPrimary || 'text').toLowerCase()
      if (modality === 'text') acc.text++
      else if (modality === 'audio') acc.audio++
      else if (modality === 'video') acc.video++
      else if (modality === 'image') acc.image++
      else if (modality === 'mixed') acc.mixed++
      return acc
    },
    { text: 0, audio: 0, video: 0, image: 0, mixed: 0 }
  )

  const modalityMetrics: ModalityMetrics = {
    ...modalityCounts,
    total: totalResponses,
  }

  // Calculate sentiment metrics
  const sentimentCounts = responses.reduce(
    (acc, r) => {
      const sentiment = (r.sentiment || 'unknown').toLowerCase()
      const modality = (r.modalityPrimary || 'text').toLowerCase()

      if (sentiment === 'positive') {
        acc.positive++
        if (modality === 'text') acc.byModality.text.positive++
        else if (modality === 'audio') acc.byModality.audio.positive++
        else if (modality === 'video') acc.byModality.video.positive++
        else if (modality === 'image') acc.byModality.image.positive++
      } else if (sentiment === 'neutral') {
        acc.neutral++
        if (modality === 'text') acc.byModality.text.neutral++
        else if (modality === 'audio') acc.byModality.audio.neutral++
        else if (modality === 'video') acc.byModality.video.neutral++
        else if (modality === 'image') acc.byModality.image.neutral++
      } else if (sentiment === 'negative') {
        acc.negative++
        if (modality === 'text') acc.byModality.text.negative++
        else if (modality === 'audio') acc.byModality.audio.negative++
        else if (modality === 'video') acc.byModality.video.negative++
        else if (modality === 'image') acc.byModality.image.negative++
      } else {
        acc.unknown++
      }
      return acc
    },
    {
      positive: 0,
      neutral: 0,
      negative: 0,
      unknown: 0,
      byModality: {
        text: { positive: 0, neutral: 0, negative: 0 },
        audio: { positive: 0, neutral: 0, negative: 0 },
        video: { positive: 0, neutral: 0, negative: 0 },
        image: { positive: 0, neutral: 0, negative: 0 },
      },
    }
  )

  const sentimentMetrics: SentimentMetrics = {
    ...sentimentCounts,
    total: totalResponses,
  }

  // Calculate language metrics
  const languageCounts = responses.reduce((acc, r) => {
    const lang = r.originalLanguage || 'unknown'
    acc[lang] = (acc[lang] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const languageDistribution = Object.entries(languageCounts)
    .map(([language, count]) => ({
      language,
      count,
      percentage: totalResponses > 0 ? (count / totalResponses) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const topLanguages = languageDistribution.slice(0, 10)
  const totalWithLanguage = responses.filter((r) => r.originalLanguage).length

  const languageMetrics: LanguageMetrics = {
    distribution: languageDistribution,
    topLanguages,
    totalWithLanguage,
    totalResponses,
  }

  // Fetch media processing metrics
  const responseIds = responses.map((r) => r.id)
  
  let audioMediaList: Array<{ status: string | null }> = []
  let videoMediaList: Array<{ status: string | null }> = []

  if (responseIds.length > 0) {
    const mediaList = await db
      .select({
        mediaType: feedbackMedia.mediaType,
        status: feedbackMedia.status,
      })
      .from(feedbackMedia)
      .where(
        and(
          eq(feedbackMedia.ownerType, 'survey_response'),
          sql`${feedbackMedia.ownerId} = ANY(${responseIds})`
        )
      )

    audioMediaList = mediaList.filter((m) => m.mediaType === 'audio')
    videoMediaList = mediaList.filter((m) => m.mediaType === 'video')
    
    const imageMediaList = mediaList.filter((m) => m.mediaType === 'image')
    
    processingMetrics.image = {
      total: imageMediaList.length,
    }
  }

  const calculateStatusCounts = (mediaList: Array<{ status: string | null }>) => {
    const counts = mediaList.reduce(
      (acc, m) => {
        const status = (m.status || 'unknown').toLowerCase()
        if (status === 'uploaded') acc.uploaded++
        else if (status === 'processing') acc.processing++
        else if (status === 'ready') acc.ready++
        else if (status === 'failed') acc.failed++
        else if (status === 'deleted') acc.deleted++
        return acc
      },
      { uploaded: 0, processing: 0, ready: 0, failed: 0, deleted: 0 }
    )
    const total = mediaList.length
    const successRate = total > 0 ? (counts.ready / total) * 100 : 0
    return { total, ...counts, successRate }
  }

  const processingMetrics: ProcessingMetrics = {
    audio: calculateStatusCounts(audioMediaList),
    video: calculateStatusCounts(videoMediaList),
  }

  return {
    modalityMetrics,
    sentimentMetrics,
    languageMetrics,
    processingMetrics,
    totalResponses,
    dateRange: dateFrom && dateTo ? { from: dateFrom, to: dateTo } : undefined,
  }
}
