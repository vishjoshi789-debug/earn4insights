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

  // A brand that pressed Pause or Close has stopped collecting. Show that
  // plainly instead of a form — a consumer who fills one in and is then
  // rejected by the server has wasted their time, and this link is emailed,
  // so people arrive here days after it was sent.
  //
  // `submitSurveyResponse` rejects these statuses too; this is the courteous
  // half, not the enforcement (see the note there).
  const isStopped = survey.status === 'paused' || survey.status === 'closed'

  if (isStopped) {
    return (
      <div className="min-h-screen bg-background py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-semibold">{survey.title}</h1>
            <p className="mt-3 text-muted-foreground">
              This survey is no longer accepting responses.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Thanks for stopping by — the brand has closed it for now.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Use specialized NPS form for NPS surveys, generic form for others
  const FormComponent = survey.type === 'nps' ? NPSResponseForm : SurveyResponseForm

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* `draft` only — a survey that was never published. Paused/closed are
            handled above; this banner would be misleading for them, since
            responses are not accepted at all rather than "for testing". */}
        {survey.status === 'draft' && (
          <div className="mb-4 p-3 bg-muted border border-border rounded-lg text-center text-sm text-muted-foreground">
            This survey is not published yet. Responses submitted here are for testing only.
          </div>
        )}
        <FormComponent survey={survey} />
      </div>
    </div>
  )
}
