'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createSurveyResponse, getResponsesBySurveyId, updateSurveyResponseById } from '@/db/repositories/surveyRepository'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import type { SurveyResponse } from '@/lib/survey-types'
import { sendSurveyResponseNotification } from '@/server/emailService'
import { analyzeSentiment } from '@/server/sentimentService'
import { normalizeTextForAnalytics } from '@/server/textNormalizationService'

export async function submitSurveyResponse(
  surveyId: string,
  answers: Record<string, string | number>,
  userName?: string,
  userEmail?: string
) {
  // Validation
  if (!surveyId || !answers || Object.keys(answers).length === 0) {
    throw new Error('Survey ID and answers are required')
  }

  // Get survey to validate and get productId
  const survey = await getSurveyById(surveyId)
  if (!survey) {
    throw new Error('Survey not found')
  }

  // Validate required questions are answered
  const requiredQuestions = survey.questions.filter(q => q.required)
  for (const question of requiredQuestions) {
    if (!(question.id in answers) || answers[question.id] === undefined || answers[question.id] === '') {
      throw new Error(`Question "${question.question}" is required`)
    }
  }

  // Extract typed text answers for multilingual normalization (Phase 1 completion)
  const typedTextAnswers = survey.questions
    .filter(q => q.type === 'text')
    .map(q => answers[q.id])
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)

  const combinedText = typedTextAnswers.join('\n\n').trim()

  const response: SurveyResponse = {
    id: randomUUID(),
    surveyId,
    productId: survey.productId,
    userName,
    userEmail,
    answers,
    submittedAt: new Date().toISOString(),
  }

  if (combinedText) {
    // Normalize all text feedback to a single language for analytics.
    const normalized = await normalizeTextForAnalytics(combinedText)
    response.originalLanguage = normalized.originalLanguage || undefined
    response.normalizedLanguage = normalized.normalizedLanguage
    response.normalizedText = normalized.normalizedText

    const sentiment = await analyzeSentiment(normalized.normalizedText)
    response.sentiment = sentiment.sentiment
  }

  await createSurveyResponse(response)

  // Send email notification (async, don't block response)
  sendSurveyResponseNotification(
    survey.title,
    surveyId,
    survey.productId,
    // Extract rating if exists
    (() => {
      const ratingQ = survey.questions.find(q => q.type === 'rating')
      return ratingQ ? Number(answers[ratingQ.id]) : undefined
    })(),
    // Extract first text answer as preview
    (() => {
      const textQ = survey.questions.find(q => q.type === 'text')
      return textQ && typeof answers[textQ.id] === 'string' 
        ? String(answers[textQ.id]).substring(0, 200) 
        : undefined
    })(),
    userName
  ).catch(err => {
    console.error('Failed to send email notification:', err)
    // Don't fail the response submission if email fails
  })

  // Revalidate relevant pages
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/surveys/${surveyId}`)
  revalidatePath(`/dashboard/products/${survey.productId}`)

  return response
}

export async function markSurveyResponseAudioAttached(params: {
  responseId: string
  modalityPrimary: 'audio' | 'mixed'
  consentCapturedAt: Date
}) {
  await updateSurveyResponseById(params.responseId, {
    modalityPrimary: params.modalityPrimary,
    consentAudio: true,
    consentCapturedAt: params.consentCapturedAt,
    processingStatus: 'ready',
  })

  revalidatePath('/dashboard/surveys')
}

// Calculate NPS score from responses
export async function calculateNPS(surveyId: string): Promise<{
  score: number
  promoters: number
  passives: number
  detractors: number
  totalResponses: number
}> {
  const survey = await getSurveyById(surveyId)
  if (!survey || survey.type !== 'nps') {
    throw new Error('Invalid NPS survey')
  }

  // Find the NPS rating question (should be the first one)
  const npsQuestion = survey.questions.find(q => q.type === 'rating' && q.scale === 10)
  if (!npsQuestion) {
    throw new Error('NPS rating question not found')
  }
  const responses = await getResponsesBySurveyId(surveyId)

  let promoters = 0
  let passives = 0
  let detractors = 0

  responses.forEach(response => {
    const rating = Number(response.answers[npsQuestion.id])
    if (!isNaN(rating)) {
      if (rating >= 9) promoters++
      else if (rating >= 7) passives++
      else detractors++
    }
  })

  const totalResponses = responses.length
  const score = totalResponses > 0
    ? Math.round(((promoters - detractors) / totalResponses) * 100)
    : 0

  return {
    score,
    promoters,
    passives,
    detractors,
    totalResponses,
  }
}

// Export survey responses as CSV
export type ExportResponsesFilters = {
  dateFrom?: string
  dateTo?: string
  ratingMin?: string
  ratingMax?: string
  language?: string
  modality?: string
  sentiment?: string
}

export async function exportResponsesToCSV(
  surveyId: string,
  filters?: ExportResponsesFilters
): Promise<string> {
  const survey = await getSurveyById(surveyId)
  if (!survey) {
    throw new Error('Survey not found')
  }
  let responses = await getResponsesBySurveyId(surveyId)

  // Apply the same filters used by the dashboard table (best-effort)
  if (filters?.dateFrom) {
    responses = responses.filter(r => new Date(r.submittedAt) >= new Date(filters.dateFrom!))
  }

  if (filters?.dateTo) {
    responses = responses.filter(r => new Date(r.submittedAt) <= new Date(filters.dateTo!))
  }

  if (filters?.ratingMin || filters?.ratingMax) {
    const ratingQuestion = survey.questions.find(q => q.type === 'rating')
    if (ratingQuestion) {
      const min = filters.ratingMin ? Number(filters.ratingMin) : null
      const max = filters.ratingMax ? Number(filters.ratingMax) : null
      responses = responses.filter(r => {
        const val = Number(r.answers[ratingQuestion.id])
        if (Number.isNaN(val)) return false
        if (min !== null && val < min) return false
        if (max !== null && val > max) return false
        return true
      })
    }
  }

  if (filters?.language) {
    responses = responses.filter(r => (r.originalLanguage || 'und') === filters.language)
  }

  if (filters?.modality) {
    responses = responses.filter(r => (r.modalityPrimary || 'text') === filters.modality)
  }

  if (filters?.sentiment) {
    responses = responses.filter(r => r.sentiment === filters.sentiment)
  }

  if (responses.length === 0) {
    return 'No responses to export'
  }

  // Build CSV headers (including multimodal/multilingual fields)
  const headers = [
    'Response ID',
    'Submitted At',
    'User Name',
    'User Email',
    ...survey.questions.map(q => q.question),
    'Modality',
    'Original Language',
    'Normalized Language',
    'Normalized Text',
    'Transcript',
    'Sentiment',
    'Processing Status',
  ]

  // Helper function to escape CSV fields
  const escapeCSVField = (value: string | undefined | null): string => {
    if (!value) return ''
    const str = String(value)
    // Escape quotes and wrap in quotes if contains comma/newline/quote
    const escaped = str.replace(/"/g, '""')
    return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') ? `"${escaped}"` : escaped
  }

  // Build CSV rows
  const rows = responses.map(response => {
    return [
      response.id,
      new Date(response.submittedAt).toLocaleString(),
      response.userName || '',
      response.userEmail || '',
      ...survey.questions.map(q => {
        const answer = response.answers[q.id]
        if (answer === undefined || answer === null) return ''
        return escapeCSVField(String(answer))
      }),
      response.modalityPrimary || 'text',
      response.originalLanguage || '',
      response.normalizedLanguage || '',
      escapeCSVField(response.normalizedText),
      escapeCSVField(response.transcriptText),
      response.sentiment || '',
      response.processingStatus || '',
    ]
  })

  // Combine into CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')

  return csvContent
}
