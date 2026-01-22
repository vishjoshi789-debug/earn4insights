import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BarChart3, Calendar } from 'lucide-react'
import { fetchAllSurveys } from '@/server/surveys/surveyService'
import { formatDistanceToNow } from 'date-fns'
import type { Survey } from '@/lib/survey-types'

// This needs to be async to call server actions
export default async function SurveysPage() {
  const allSurveys = await fetchAllSurveys()

  // Group surveys by type
  const npsSurveys = allSurveys.filter((s) => s.type === 'nps')
  const csatSurveys = allSurveys.filter((s) => s.type === 'csat')
  const customSurveys = allSurveys.filter((s) => s.type === 'custom')

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Surveys & NPS</h1>
          <p className="text-muted-foreground mt-1">
            Collect structured feedback from your users
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/surveys/create?productId=demo">
            <Plus className="w-4 h-4 mr-2" />
            Create Survey
          </Link>
        </Button>
      </div>

      {/* NPS Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">NPS Surveys</h2>
        {npsSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No NPS surveys yet. Create one to start tracking Net Promoter Score.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {npsSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>

      {/* CSAT Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">CSAT Surveys</h2>
        {csatSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No CSAT surveys yet. Create one to measure customer satisfaction.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {csatSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>

      {/* Custom Surveys */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Custom Surveys</h2>
        {customSurveys.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No custom surveys yet. Build your own survey with custom questions.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {customSurveys.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function SurveyCard({ survey }: { survey: Survey }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{survey.title}</CardTitle>
              <Badge variant={survey.isActive ? 'default' : 'secondary'}>
                {survey.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {survey.description && (
              <p className="text-sm text-muted-foreground">{survey.description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <BarChart3 className="w-4 h-4" />
            <span>{survey.questions.length} questions</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDistanceToNow(new Date(survey.createdAt), { addSuffix: true })}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/surveys/${survey.id}`}>
              View Details
            </Link>
          </Button>
          <Button variant="ghost" size="sm">
            View Responses
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
