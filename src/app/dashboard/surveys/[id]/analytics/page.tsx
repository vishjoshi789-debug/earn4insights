import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, BarChart3, Languages, MessageSquare, Mic, Video, TrendingUp } from 'lucide-react'
import { fetchSurvey } from '@/server/surveys/surveyService'
import { calculateMultimodalAnalytics } from '@/server/surveys/analyticsService'
import ModalityChart from './ModalityChart'
import SentimentChart from './SentimentChart'
import LanguageChart from './LanguageChart'
import ProcessingMetricsCard from './ProcessingMetricsCard'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    dateFrom?: string
    dateTo?: string
  }>
}

export default async function AnalyticsPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const filters = await searchParams

  const survey = await fetchSurvey(id)
  if (!survey) notFound()

  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined

  const analytics = await calculateMultimodalAnalytics({
    surveyId: id,
    dateFrom,
    dateTo,
  })

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/surveys/${id}`}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Survey
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/surveys/${id}/responses`}>
              View Responses
            </Link>
          </Button>
        </div>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Multimodal Analytics</h1>
        <p className="text-muted-foreground">
          Unified insights across text, audio, and video feedback for <span className="font-semibold">{survey.title}</span>
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Text Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.modalityMetrics.text}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalResponses > 0
                ? ((analytics.modalityMetrics.text / analytics.totalResponses) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mic className="w-4 h-4" />
              Audio Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.modalityMetrics.audio}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalResponses > 0
                ? ((analytics.modalityMetrics.audio / analytics.totalResponses) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Video className="w-4 h-4" />
              Video Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.modalityMetrics.video}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalResponses > 0
                ? ((analytics.modalityMetrics.video / analytics.totalResponses) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Image Feedback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{analytics.modalityMetrics.image}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalResponses > 0
                ? ((analytics.modalityMetrics.image / analytics.totalResponses) * 100).toFixed(1)
                : 0}
              % of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Modality & Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Feedback by Modality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ModalityChart metrics={analytics.modalityMetrics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Sentiment Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentChart metrics={analytics.sentimentMetrics} />
          </CardContent>
        </Card>
      </div>

      {/* Language Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Language Distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {analytics.languageMetrics.totalWithLanguage} of {analytics.totalResponses} responses have detected language
          </p>
        </CardHeader>
        <CardContent>
          <LanguageChart metrics={analytics.languageMetrics} />
        </CardContent>
      </Card>

      {/* Processing Metrics */}
      <ProcessingMetricsCard metrics={analytics.processingMetrics} />
    </div>
  )
}
