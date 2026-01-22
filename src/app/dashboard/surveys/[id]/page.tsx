import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, BarChart3, Code } from 'lucide-react'
import { fetchSurvey } from '@/server/surveys/surveyService'
import { formatDistanceToNow } from 'date-fns'
import CopyLinkButton from './CopyLinkButton'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function SurveyDetailPage({ params }: PageProps) {
  const { id } = await params
  const survey = await fetchSurvey(id)

  if (!survey) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/surveys">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Surveys
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{survey.title}</h1>
            <Badge variant={survey.isActive ? 'default' : 'secondary'}>
              {survey.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {survey.description && (
            <p className="text-muted-foreground">{survey.description}</p>
          )}
        </div>
      </div>

      {/* Survey Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Information</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <p className="text-lg font-semibold uppercase">{survey.type}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Questions</p>
            <p className="text-lg font-semibold">{survey.questions.length}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-lg font-semibold">
              {formatDistanceToNow(new Date(survey.createdAt), { addSuffix: true })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {survey.questions.map((question, index) => (
            <div key={question.id} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Question {index + 1}</span>
                    {question.required && (
                      <Badge variant="outline" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2">{question.question}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="capitalize">{question.type.replace('-', ' ')}</span>
                {question.scale && <span>Scale: 1-{question.scale}</span>}
                {question.options && (
                  <span>{question.options.length} options</span>
                )}
              </div>

              {question.options && question.options.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-medium">Options:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {question.options.map((option, oIndex) => (
                      <li key={oIndex}>• {option}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Survey Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this survey with your users to start collecting responses.
          </p>
          
          {/* Survey Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Survey Link</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/survey/${survey.id}`}
                className="font-mono text-sm"
              />
              <CopyLinkButton url={`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/survey/${survey.id}`} />
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/surveys/${survey.id}/responses`}>
                <BarChart3 className="w-4 h-4 mr-2" />
                View Responses
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/surveys/${survey.id}/embed`}>
                <Code className="w-4 h-4 mr-2" />
                Embed Code
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/survey/${survey.id}`} target="_blank">
                Fill Out Survey (Test)
              </Link>
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            💡 Click "Fill Out Survey" to test the response form. Responses will appear in the analytics dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
