import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { surveys, surveyResponses } from '@/db/schema'
import type { Survey as DBSurvey, NewSurvey, SurveyResponse as DBSurveyResponse, NewSurveyResponse } from '@/db/schema'
import type { Survey, SurveyResponse } from '@/lib/survey-types'

/**
 * Convert database survey to app Survey type
 */
function toSurvey(dbSurvey: DBSurvey): Survey {
  return {
    id: dbSurvey.id,
    productId: dbSurvey.productId,
    title: dbSurvey.title,
    description: dbSurvey.description || undefined,
    type: dbSurvey.type as Survey['type'],
    isActive: dbSurvey.status === 'active',
    status: dbSurvey.status as Survey['status'],
    createdAt: dbSurvey.createdAt.toISOString(),
    updatedAt: dbSurvey.updatedAt.toISOString(),
    questions: dbSurvey.questions as Survey['questions'],
    settings: dbSurvey.settings as Survey['settings'],
  }
}

/**
 * Convert database survey response to app SurveyResponse type
 */
function toSurveyResponse(dbResponse: DBSurveyResponse): SurveyResponse {
  return {
    id: dbResponse.id,
    surveyId: dbResponse.surveyId,
    productId: dbResponse.productId,
    submittedAt: dbResponse.submittedAt.toISOString(),
    userName: dbResponse.userName || undefined,
    userEmail: dbResponse.userEmail || undefined,
    answers: dbResponse.answers as SurveyResponse['answers'],
    npsScore: dbResponse.npsScore || undefined,
    sentiment: dbResponse.sentiment as SurveyResponse['sentiment'],

    // Phase 0/1 fields (optional)
    modalityPrimary: (dbResponse as any).modalityPrimary ?? undefined,
    processingStatus: (dbResponse as any).processingStatus ?? undefined,
    originalLanguage: (dbResponse as any).originalLanguage ?? undefined,
    normalizedLanguage: (dbResponse as any).normalizedLanguage ?? undefined,
    normalizedText: (dbResponse as any).normalizedText ?? undefined,
    transcriptText: (dbResponse as any).transcriptText ?? undefined,
  }
}

/**
 * Get all surveys
 */
export async function getAllSurveys(): Promise<Survey[]> {
  const dbSurveys = await db.select().from(surveys)
  return dbSurveys.map(toSurvey)
}

/**
 * Get a single survey by ID
 */
export async function getSurveyById(id: string): Promise<Survey | null> {
  const dbSurveys = await db.select().from(surveys).where(eq(surveys.id, id)).limit(1)
  return dbSurveys.length > 0 ? toSurvey(dbSurveys[0]) : null
}

/**
 * Get surveys by product ID
 */
export async function getSurveysByProductId(productId: string): Promise<Survey[]> {
  const dbSurveys = await db.select().from(surveys).where(eq(surveys.productId, productId))
  return dbSurveys.map(toSurvey)
}

/**
 * Create new survey
 */
export async function createSurvey(survey: Survey): Promise<Survey> {
  const [created] = await db
    .insert(surveys)
    .values({
      id: survey.id,
      productId: survey.productId,
      title: survey.title,
      description: survey.description,
      type: survey.type,
      status: survey.status || 'draft',
      questions: survey.questions as any,
      settings: survey.settings as any,
    })
    .returning()
  
  return toSurvey(created)
}

/**
 * Update survey
 */
export async function updateSurvey(id: string, updates: Partial<Survey>): Promise<Survey | null> {
  const updateData: any = {}
  if (updates.title) updateData.title = updates.title
  if (updates.description !== undefined) updateData.description = updates.description
  if (updates.type) updateData.type = updates.type
  if (updates.status) updateData.status = updates.status
  if (updates.questions) updateData.questions = updates.questions
  if (updates.settings) updateData.settings = updates.settings
  updateData.updatedAt = new Date()

  const [updated] = await db
    .update(surveys)
    .set(updateData)
    .where(eq(surveys.id, id))
    .returning()
  
  return updated ? toSurvey(updated) : null
}

/**
 * Delete survey
 */
export async function deleteSurvey(id: string): Promise<boolean> {
  const result = await db.delete(surveys).where(eq(surveys.id, id))
  return result.length > 0
}

/**
 * Get survey responses by survey ID
 */
export async function getResponsesBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
  const dbResponses = await db.select().from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId))
  return dbResponses.map(toSurveyResponse)
}

/**
 * Get survey responses by product ID
 */
export async function getResponsesByProductId(productId: string): Promise<SurveyResponse[]> {
  const dbResponses = await db.select().from(surveyResponses).where(eq(surveyResponses.productId, productId))
  return dbResponses.map(toSurveyResponse)
}

/**
 * Create survey response
 */
export async function createSurveyResponse(response: SurveyResponse): Promise<SurveyResponse> {
  const [created] = await db
    .insert(surveyResponses)
    .values({
      id: response.id,
      surveyId: response.surveyId,
      productId: response.productId,
      userName: response.userName,
      userEmail: response.userEmail,
      answers: response.answers as any,
      npsScore: response.npsScore,
      sentiment: response.sentiment,
      modalityPrimary: response.modalityPrimary,
      processingStatus: response.processingStatus,
      originalLanguage: response.originalLanguage,
      normalizedText: response.normalizedText,
      normalizedLanguage: response.normalizedLanguage,
      transcriptText: response.transcriptText,
    })
    .returning()
  
  return toSurveyResponse(created)
}

/**
 * Update survey response (Phase 1: multimodal metadata + consent).
 *
 * NOTE: We keep this intentionally small and backwards-compatible.
 */
export async function updateSurveyResponseById(
  id: string,
  updates: Partial<{
    modalityPrimary: string
    processingStatus: string
    consentAudio: boolean
    consentVideo: boolean
    consentImages: boolean
    consentCapturedAt: Date

    // Phase 1.5+: admin review / overrides
    originalLanguage: string | null
    normalizedLanguage: string | null
    normalizedText: string | null
    sentiment: 'positive' | 'neutral' | 'negative' | null
    transcriptText: string | null
  }>
): Promise<void> {
  const updateData: any = {}
  if (updates.modalityPrimary !== undefined) updateData.modalityPrimary = updates.modalityPrimary
  if (updates.processingStatus !== undefined) updateData.processingStatus = updates.processingStatus
  if (updates.consentAudio !== undefined) updateData.consentAudio = updates.consentAudio
  if (updates.consentVideo !== undefined) updateData.consentVideo = updates.consentVideo
  if (updates.consentImages !== undefined) updateData.consentImages = updates.consentImages
  if (updates.consentCapturedAt !== undefined) updateData.consentCapturedAt = updates.consentCapturedAt
  if (updates.originalLanguage !== undefined) updateData.originalLanguage = updates.originalLanguage ?? null
  if (updates.normalizedLanguage !== undefined) updateData.normalizedLanguage = updates.normalizedLanguage ?? null
  if (updates.normalizedText !== undefined) updateData.normalizedText = updates.normalizedText ?? null
  if (updates.sentiment !== undefined) updateData.sentiment = updates.sentiment ?? null
  if (updates.transcriptText !== undefined) updateData.transcriptText = updates.transcriptText ?? null

  if (Object.keys(updateData).length === 0) return

  await db.update(surveyResponses).set(updateData).where(eq(surveyResponses.id, id))
}
