import { notFound } from 'next/navigation'
import SurveyResponseForm from '@/components/survey-response-form'
import NPSResponseForm from '@/components/nps-response-form'
import { fetchSurvey } from '@/server/surveys/surveyService'

type PageProps = {
  params: Promise<{ surveyId: string }>
}

export default async function SurveyResponsePage({ params }: PageProps) {
  const { surveyId } = await params
  const survey = await fetchSurvey(surveyId)

  if (!survey || !survey.isActive) {
    notFound()
  }

  // Use specialized NPS form for NPS surveys, generic form for others
  const FormComponent = survey.type === 'nps' ? NPSResponseForm : SurveyResponseForm

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <FormComponent survey={survey} />
      </div>
    </div>
  )
}
