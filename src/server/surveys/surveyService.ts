'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import {
  getAllSurveys,
  getSurveyById,
  getSurveysByProductId,
  createSurvey as createSurveyInDB,
  updateSurvey as updateSurveyInDB,
  deleteSurvey as deleteSurveyFromDB,
} from '@/db/repositories/surveyRepository'
import type { Survey, SurveyQuestion, SurveyType } from '@/lib/survey-types'
import { createNPSSurvey, createCSATSurvey } from '@/lib/survey-types'

export async function fetchAllSurveys() {
  return await getAllSurveys()
}

export async function fetchSurvey(surveyId: string) {
  return await getSurveyById(surveyId)
}

export async function fetchProductSurveys(productId: string) {
  return await getSurveysByProductId(productId)
}

export async function createSurvey(
  productId: string,
  title: string,
  description: string | undefined,
  type: SurveyType,
  questions: SurveyQuestion[]
) {
  // Validation
  if (!productId || !title.trim()) {
    throw new Error('Product ID and title are required')
  }

  if (type === 'custom' && questions.length === 0) {
    throw new Error('Custom surveys must have at least one question')
  }

  // Generate survey based on type
  let surveyData: Omit<Survey, 'id' | 'createdAt'>

  if (type === 'nps') {
    surveyData = createNPSSurvey(productId, title, description)
  } else if (type === 'csat') {
    surveyData = createCSATSurvey(productId, title, description)
  } else {
    // Custom survey
    surveyData = {
      productId,
      title,
      description,
      type: 'custom',
      isActive: true,
      questions,
    }
  }

  const survey: Survey = {
    ...surveyData,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  }

  await createSurveyInDB(survey)

  // Revalidate the surveys page
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/products/${productId}`)

  return survey
}

export async function toggleSurveyActive(surveyId: string, isActive: boolean) {
  const survey = await updateSurveyInDB(surveyId, { status: isActive ? 'active' : 'paused' })

  if (survey) {
    revalidatePath('/dashboard/surveys')
    revalidatePath(`/dashboard/products/${survey.productId}`)
  }

  return survey
}

export async function deleteSurvey(surveyId: string) {
  const survey = await getSurveyById(surveyId)
  if (!survey) {
    throw new Error('Survey not found')
  }
  
  const success = await deleteSurveyFromDB(surveyId)
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/products/${survey.productId}`)

  return success
}
