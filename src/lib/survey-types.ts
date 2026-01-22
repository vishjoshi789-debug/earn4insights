export type QuestionType = 'rating' | 'text' | 'multiple-choice'

export type RatingScale = 5 | 10

export type SurveyQuestion = {
  id: string
  type: QuestionType
  question: string
  required?: boolean
  // For rating questions
  scale?: RatingScale
  // For multiple choice questions
  options?: string[]
}

export type SurveyType = 'nps' | 'csat' | 'custom'

export type Survey = {
  id: string
  productId: string
  title: string
  description?: string
  type: SurveyType
  isActive: boolean
  createdAt: string
  questions: SurveyQuestion[]
}

export type SurveyResponse = {
  id: string
  surveyId: string
  productId: string
  userId?: string
  userName?: string
  userEmail?: string
  answers: Record<string, string | number>
  submittedAt: string
}

// Helper to create NPS survey
export function createNPSSurvey(productId: string, title?: string, description?: string): Omit<Survey, 'id' | 'createdAt'> {
  return {
    productId,
    title: title || 'How likely are you to recommend us?',
    description: description || 'Your feedback helps us improve',
    type: 'nps',
    isActive: true,
    questions: [
      {
        id: 'q_nps_score',
        type: 'rating',
        question: 'On a scale of 0-10, how likely are you to recommend our product to a friend or colleague?',
        scale: 10,
        required: true,
      },
      {
        id: 'q_nps_reason',
        type: 'text',
        question: 'What is the main reason for your score?',
        required: false,
      },
    ],
  }
}

// Helper to create CSAT survey
export function createCSATSurvey(productId: string, title?: string, description?: string): Omit<Survey, 'id' | 'createdAt'> {
  return {
    productId,
    title: title || 'How satisfied are you with our product?',
    description: description || 'We value your feedback',
    type: 'csat',
    isActive: true,
    questions: [
      {
        id: 'q_csat_score',
        type: 'rating',
        question: 'How satisfied are you with our product?',
        scale: 5,
        required: true,
      },
      {
        id: 'q_csat_feedback',
        type: 'text',
        question: 'What could we improve?',
        required: false,
      },
    ],
  }
}
