import { Survey } from './survey-types';

export const npsSurvey: Survey = {
  id: 'survey_nps_default',
  title: 'How likely are you to recommend us?',
  description: 'Your feedback helps us improve',
  type: 'nps',
  isActive: true,
  createdAt: new Date().toISOString(),
  questions: [
    {
      id: 'q_nps_score',
      type: 'rating',
      question: 'How likely are you to recommend our brand to a friend?',
      scale: 10,
    },
    {
      id: 'q_nps_reason',
      type: 'text',
      question: 'What is the main reason for your score?',
    },
  ],
};

export const customSurveys: Survey[] = [];
