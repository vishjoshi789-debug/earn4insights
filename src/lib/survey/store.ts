import fs from 'fs/promises'
import path from 'path'
import type { Survey } from '../survey-types'

const SURVEYS_FILE = path.join(process.cwd(), 'data', 'surveys.json')

// Ensure surveys file exists
async function ensureSurveysFile() {
  try {
    await fs.access(SURVEYS_FILE)
  } catch {
    await fs.writeFile(SURVEYS_FILE, '[]', 'utf-8')
  }
}

export async function getAllSurveys(): Promise<Survey[]> {
  await ensureSurveysFile()
  const data = await fs.readFile(SURVEYS_FILE, 'utf-8')
  return JSON.parse(data)
}

export async function getSurveyById(surveyId: string): Promise<Survey | undefined> {
  const surveys = await getAllSurveys()
  return surveys.find((s) => s.id === surveyId)
}

export async function getSurveysByProductId(productId: string): Promise<Survey[]> {
  const surveys = await getAllSurveys()
  return surveys.filter((s) => s.productId === productId)
}

export async function createSurvey(survey: Survey): Promise<Survey> {
  await ensureSurveysFile()
  const surveys = await getAllSurveys()
  
  surveys.push(survey)
  
  await fs.writeFile(SURVEYS_FILE, JSON.stringify(surveys, null, 2), 'utf-8')
  
  return survey
}

export async function updateSurvey(surveyId: string, updates: Partial<Survey>): Promise<Survey | undefined> {
  await ensureSurveysFile()
  const surveys = await getAllSurveys()
  
  const index = surveys.findIndex((s) => s.id === surveyId)
  if (index === -1) return undefined
  
  surveys[index] = { ...surveys[index], ...updates }
  
  await fs.writeFile(SURVEYS_FILE, JSON.stringify(surveys, null, 2), 'utf-8')
  
  return surveys[index]
}

export async function deleteSurvey(surveyId: string): Promise<boolean> {
  await ensureSurveysFile()
  const surveys = await getAllSurveys()
  
  const filtered = surveys.filter((s) => s.id !== surveyId)
  if (filtered.length === surveys.length) return false
  
  await fs.writeFile(SURVEYS_FILE, JSON.stringify(filtered, null, 2), 'utf-8')
  
  return true
}
