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

  if (!survey) {
    notFound()
  }

  // Use specialized NPS form for NPS surveys, generic form for others
  const FormComponent = survey.type === 'nps' ? NPSResponseForm : SurveyResponseForm

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {!survey.isActive && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center text-sm text-yellow-800">
            This survey is currently inactive. Responses submitted here are for testing only.
          </div>
        )}
        <FormComponent survey={survey} />
      </div>
    </div>
  )
}
