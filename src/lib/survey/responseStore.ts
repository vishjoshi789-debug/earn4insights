import fs from 'fs/promises'
import path from 'path'
import type { SurveyResponse } from '../survey-types'

const RESPONSES_FILE = path.join(process.cwd(), 'data', 'survey-responses.json')

// Ensure responses file exists
async function ensureResponsesFile() {
  try {
    await fs.access(RESPONSES_FILE)
  } catch {
    await fs.writeFile(RESPONSES_FILE, '[]', 'utf-8')
  }
}

export async function getAllResponses(): Promise<SurveyResponse[]> {
  await ensureResponsesFile()
  const data = await fs.readFile(RESPONSES_FILE, 'utf-8')
  return JSON.parse(data)
}

export async function getResponsesBySurveyId(surveyId: string): Promise<SurveyResponse[]> {
  const responses = await getAllResponses()
  return responses.filter((r) => r.surveyId === surveyId)
}

export async function getResponsesByProductId(productId: string): Promise<SurveyResponse[]> {
  const responses = await getAllResponses()
  return responses.filter((r) => r.productId === productId)
}

export async function createResponse(response: SurveyResponse): Promise<SurveyResponse> {
  await ensureResponsesFile()
  const responses = await getAllResponses()
  
  responses.push(response)
  
  await fs.writeFile(RESPONSES_FILE, JSON.stringify(responses, null, 2), 'utf-8')
  
  return response
}
