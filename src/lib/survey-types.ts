export type SurveyQuestion = {
  id: string;
  type: 'rating' | 'nps' | 'text' | 'multiple-choice';
  label: string;
  options?: string[];
};

export type Survey = {
  id: string;
  title: string;
  type: 'nps' | 'custom';
  isActive: boolean;
  createdAt: string;
  questions: SurveyQuestion[];
};
export type SurveyResponse = {
  surveyId: string;
  userId: string;
  answers: Record<string, string | number>;
  submittedAt: string;
};
