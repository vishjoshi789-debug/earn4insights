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

export type SurveySettings = {
  /**
   * Phase 0 feature flags (default off).
   * These control whether public survey pages are allowed to upload audio/video.
   */
  allowAudio?: boolean
  allowVideo?: boolean

  /**
   * Reserved for Phase 1+ (limits, retention, etc.)
   */
  [key: string]: any
}

export type Survey = {
  id: string
  productId: string
  title: string
  description?: string
  type: SurveyType
  isActive: boolean
  status?: 'draft' | 'active' | 'paused' | 'closed'  // Database field
  createdAt: string
  updatedAt?: string  // Database field
  questions: SurveyQuestion[]
  settings?: SurveySettings  // Database field for additional settings
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
  npsScore?: number  // Database field for NPS scores
  sentiment?: 'positive' | 'neutral' | 'negative'  // Database field

  // Phase 0/1 multimodal + multilingual fields (optional; backwards-compatible)
  modalityPrimary?: 'text' | 'audio' | 'video' | 'mixed'
  processingStatus?: 'ready' | 'processing' | 'failed'
  originalLanguage?: string
  normalizedLanguage?: string
  normalizedText?: string
  transcriptText?: string
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
