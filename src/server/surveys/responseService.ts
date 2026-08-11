'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createSurveyResponse, getResponsesBySurveyId, updateSurveyResponseById } from '@/db/repositories/surveyRepository'
import { getSurveyById } from '@/db/repositories/surveyRepository'
import { getProductById } from '@/db/repositories/productRepository'
import type { SurveyResponse } from '@/lib/survey-types'
import { sendSurveyResponseNotification } from '@/server/surveys/responseNotificationEmail'
import { analyzeSentiment } from '@/server/sentimentService'
import { normalizeTextForAnalytics } from '@/server/textNormalizationService'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'

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

  // A paused or closed survey must actually STOP collecting. Enforced here,
  // not only in the page: this is a `'use server'` action, so hiding the form
  // would leave the endpoint open, and anyone with the tab already loaded
  // could keep submitting after the brand pressed Pause. A control that only
  // hides its own button is not a control.
  if (survey.status === 'paused' || survey.status === 'closed') {
    throw new Error('This survey is no longer accepting responses.')
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

  // ── Award points for survey completion (B23) ─────────────────
  // Identity comes from the SESSION, server-side — never a client value.
  // This is a server action; a client-passed id could be forged/farmed, so
  // we resolve the real users.id via auth(). Anonymous respondents (no
  // session) earn nothing and must NOT throw.
  const session = await auth()
  const pointsUserId = session?.user?.id ?? null
  if (pointsUserId) {
    const { awardPoints, POINT_VALUES, hasPointsAwarded } = await import('@/server/pointsService')
    try {
      // Award once per (user, survey): sourceId = surveyId (not response.id),
      // so resubmitting the same survey can't farm points.
      const already = await hasPointsAwarded(pointsUserId, 'survey_complete', surveyId)
      if (!already) {
        await awardPoints(
          pointsUserId,
          POINT_VALUES.survey_complete,
          'survey_complete',
          surveyId,
          `Completed survey: ${survey.title.slice(0, 50)}`,
        )
      }
    } catch (err) {
      // Saving the response is never blocked by a points failure — but log
      // LOUD so a future failure is visible/alertable (not silently swallowed).
      console.error('[B23][survey_points] FAILED to credit survey points', {
        userId: pointsUserId,
        surveyId,
        amount: POINT_VALUES.survey_complete,
        err: err instanceof Error ? err.message : String(err),
      })
    }

    // AI contribution scoring — genuinely best-effort, its own separate catch.
    try {
      const { recordContribution } = await import('@/server/contributionPipeline')
      recordContribution({
        userId: pointsUserId,
        contributionType: 'survey_complete',
        rawContent: combinedText || Object.values(answers).filter((a) => typeof a === 'string').join(' '),
        productId: survey.productId,
        sourceId: surveyId,
        metadata: { surveyTitle: survey.title, npsScore: response.npsScore, sentiment: response.sentiment },
      }).catch(err => console.error('[ContributionPipeline] survey error (non-blocking):', err))
    } catch (err) {
      console.error('[ContributionPipeline] survey error (non-blocking):', err)
    }
  }

  // ── Extract intent signals (non-blocking) ────────────────
  try {
    const { extractAndPersistIntents } = await import('@/server/intentExtractionService')
    const textForIntent = combinedText || Object.values(answers).filter((a) => typeof a === 'string').join(' ')
    if (textForIntent && textForIntent.length > 10) {
      await extractAndPersistIntents({
        userId: response.userEmail || '',
        text: textForIntent,
        productId: survey.productId,
        sourceType: 'survey',
        sourceId: response.id || surveyId,
      })
    }
  } catch (err) {
    console.error('[SurveyResponse] Intent extraction failed (non-blocking):', err)
  }

  // ── Alert brand about survey completion (non-blocking) ──────
  try {
    const { alertOnSurveyComplete } = await import('@/server/brandAlertService')
    const { db: dbImport } = await import('@/db')
    const { products: productsTable } = await import('@/db/schema')
    const { eq: eqOp } = await import('drizzle-orm')
    const [product] = await dbImport.select({ ownerId: productsTable.ownerId, name: productsTable.name }).from(productsTable).where(eqOp(productsTable.id, survey.productId)).limit(1)
    if (product?.ownerId) {
      alertOnSurveyComplete({
        brandId: product.ownerId,
        productId: survey.productId,
        productName: product.name,
        surveyTitle: survey.title,
        consumerId: response.userEmail || undefined,
        consumerName: userName || undefined,
        responseId: response.id || surveyId,
        npsScore: response.npsScore ?? undefined,
        sentiment: response.sentiment || undefined,
      }).catch((err: any) => console.error('[SurveyResponse] Brand alert failed:', err))
    }
  } catch (err) {
    console.error('[SurveyResponse] Brand alert failed (non-blocking):', err)
  }

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

/**
 * Resolve a survey's owning brand (survey → product → products.owner_id) and
 * assert the current session is that brand. Returns the survey on success.
 *
 * SECURITY: `exportResponsesToCSV` is a 'use server' action, i.e. a directly
 * invokable endpoint — not merely the dashboard button's callback. Without this
 * check any authenticated caller could POST an arbitrary surveyId and receive
 * every respondent's name and email.
 *
 * Fails closed and stays silent: no session, unknown survey, missing product,
 * product with no owner_id, and owner mismatch all raise the SAME generic
 * error, so a caller cannot probe which survey ids exist.
 */
async function assertSurveyOwnedByCaller(surveyId: string) {
  const denied = () => new Error('Survey not found or access denied')

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw denied()

  const survey = await getSurveyById(surveyId)
  if (!survey?.productId) throw denied()

  // Admin bypass — platform-wide policy, see lib/auth/roles.ts.
  if (isAdminSession(session)) return survey

  const product = await getProductById(survey.productId)
  // Deny when owner_id is absent — an unowned product must not be readable by
  // every authenticated user.
  if (!product?.ownerId || product.ownerId !== userId) throw denied()

  return survey
}

export async function exportResponsesToCSV(
  surveyId: string,
  filters?: ExportResponsesFilters
): Promise<string> {
  const survey = await assertSurveyOwnedByCaller(surveyId)
  let responses = await getResponsesBySurveyId(surveyId)

  // Apply the same filters used by the dashboard table (best-effort)
  if (filters?.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    responses = responses.filter(r => new Date(r.submittedAt) >= fromDate)
  }

  if (filters?.dateTo) {
    // Widen to end-of-day. A `type="date"` input yields midnight, so a bare
    // `<= dateTo` excludes everything submitted during that day — a
    // single-day range exported as an empty file. The responses PAGE already
    // does this (its own dateTo filter sets 23:59:59.999), so without it the
    // export silently disagreed with the table the brand was looking at.
    const toDate = new Date(filters.dateTo)
    toDate.setHours(23, 59, 59, 999)
    responses = responses.filter(r => new Date(r.submittedAt) <= toDate)
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
