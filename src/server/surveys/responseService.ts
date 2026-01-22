'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createResponse } from '@/lib/survey/responseStore'
import { getSurveyById } from '@/lib/survey/store'
import type { SurveyResponse } from '@/lib/survey-types'

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

  const response: SurveyResponse = {
    id: randomUUID(),
    surveyId,
    productId: survey.productId,
    userName,
    userEmail,
    answers,
    submittedAt: new Date().toISOString(),
  }

  await createResponse(response)

  // Revalidate relevant pages
  revalidatePath('/dashboard/surveys')
  revalidatePath(`/dashboard/surveys/${surveyId}`)
  revalidatePath(`/dashboard/products/${survey.productId}`)

  return response
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

  const { getResponsesBySurveyId } = await import('@/lib/survey/responseStore')
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
