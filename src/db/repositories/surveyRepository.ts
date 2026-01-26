import { eq, and } from 'drizzle-orm'
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
    })
    .returning()
  
  return toSurveyResponse(created)
}
