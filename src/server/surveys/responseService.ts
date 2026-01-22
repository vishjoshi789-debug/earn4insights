'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createResponse } from '@/lib/survey/responseStore'
import { getSurveyById } from '@/lib/survey/store'
import type { SurveyResponse } from '@/lib/survey-types'
import { sendSurveyResponseNotification } from '@/server/emailService'

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

// Export survey responses as CSV
export async function exportResponsesToCSV(surveyId: string): Promise<string> {
  const survey = await getSurveyById(surveyId)
  if (!survey) {
    throw new Error('Survey not found')
  }

  const { getResponsesBySurveyId } = await import('@/lib/survey/responseStore')
  const responses = await getResponsesBySurveyId(surveyId)

  if (responses.length === 0) {
    return 'No responses to export'
  }

  // Build CSV headers
  const headers = [
    'Response ID',
    'Submitted At',
    'User Name',
    'User Email',
    ...survey.questions.map(q => q.text),
  ]

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
        if (typeof answer === 'string') {
          // Escape quotes and wrap in quotes if contains comma/newline
          const escaped = answer.replace(/"/g, '""')
          return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped
        }
        return String(answer)
      }),
    ]
  })

  // Combine into CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n')

  return csvContent
}
