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
import type { Survey, SurveyQuestion, SurveyType, SurveySettings } from '@/lib/survey-types'
import { createNPSSurvey, createCSATSurvey } from '@/lib/survey-types'
import { notifyNewSurvey } from '@/server/campaigns/surveyNotificationCampaign'

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
  questions: SurveyQuestion[],
  settings?: SurveySettings
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
    settings: {
      // Phase 0 flags: default off unless explicitly enabled
      allowAudio: Boolean(settings?.allowAudio),
      allowVideo: Boolean(settings?.allowVideo),
      ...(settings || {}),
    },
  }

  await createSurveyInDB(survey)

  // Non-blocking: notify targeted consumers about the new survey
  notifyNewSurvey(survey.id).catch((err) =>
    console.error('[createSurvey] notifyNewSurvey error:', err)
  )

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

export async function updateSurveyQuestions(
  surveyId: string,
  questions: SurveyQuestion[]
) {
  if (!surveyId) throw new Error('Survey ID is required')
  if (questions.length === 0) throw new Error('At least one question is required')

  // Validate each question
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.question.trim()) throw new Error(`Question ${i + 1} text is required`)
    if (q.type === 'multiple-choice') {
      if (!q.options || q.options.length < 2) {
        throw new Error(`Question ${i + 1} must have at least 2 options`)
      }
      if (q.options.some(opt => !opt.trim())) {
        throw new Error(`All options in question ${i + 1} must have text`)
      }
    }
  }

  const survey = await updateSurveyInDB(surveyId, { questions })
  if (!survey) throw new Error('Survey not found')

  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/surveys/${surveyId}`)
  revalidatePath(`/survey/${surveyId}`)

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
