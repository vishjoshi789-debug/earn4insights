import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, TrendingUp, Users, Star } from 'lucide-react'
import { fetchSurvey } from '@/server/surveys/surveyService'
import { calculateNPS } from '@/server/surveys/responseService'
import { getResponsesBySurveyId } from '@/lib/survey/responseStore'
import { formatDistanceToNow } from 'date-fns'
import ResponsesTable from './ResponsesTable'
import NPSTrendChart from './NPSTrendChart'
import ExportResponsesButton from './ExportResponsesButton'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; ratingMin?: string; ratingMax?: string }>
}

export default async function SurveyResponsesPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const filters = await searchParams
  
  const survey = await fetchSurvey(id)
  if (!survey) notFound()

  const allResponses = await getResponsesBySurveyId(id)
  
  // Apply filters
  let filteredResponses = allResponses
  
  if (filters.dateFrom) {
    filteredResponses = filteredResponses.filter(r => 
      new Date(r.submittedAt) >= new Date(filters.dateFrom!)
    )
  }
  
  if (filters.dateTo) {
    filteredResponses = filteredResponses.filter(r => 
      new Date(r.submittedAt) <= new Date(filters.dateTo!)
    )
  }

  // Calculate stats
  const totalResponses = filteredResponses.length
  
  let npsData = null
  let avgRating = null
  
  if (survey.type === 'nps' || survey.type === 'csat') {
    const ratingQuestion = survey.questions.find(q => q.type === 'rating')
    if (ratingQuestion) {
      const ratings = filteredResponses
        .map(r => Number(r.answers[ratingQuestion.id]))
        .filter(r => !isNaN(r))
      
      avgRating = ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
        : null
    }
  }
  
  if (survey.type === 'nps') {
    try {
      npsData = await calculateNPS(id)
    } catch (err) {
      console.error('Failed to calculate NPS:', err)
    }
  }

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
          <div>
            <h1 className="text-3xl font-bold">{survey.title} - Responses</h1>
            <p className="text-muted-foreground mt-1">
              Analyze feedback and track trends
            </p>
          </div>
        </div>
        <ExportResponsesButton surveyId={id} responses={filteredResponses} />
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalResponses}</div>
            <p className="text-xs text-muted-foreground">
              {allResponses.length} total
            </p>
          </CardContent>
        </Card>

        {npsData && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{npsData.score}</div>
                <p className="text-xs text-muted-foreground">
                  {npsData.score >= 50 ? 'Excellent' : npsData.score >= 0 ? 'Good' : 'Needs Improvement'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promoters</CardTitle>
                <Star className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{npsData.promoters}</div>
                <p className="text-xs text-muted-foreground">
                  {totalResponses > 0 ? Math.round((npsData.promoters / totalResponses) * 100) : 0}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Detractors</CardTitle>
                <Star className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{npsData.detractors}</div>
                <p className="text-xs text-muted-foreground">
                  {totalResponses > 0 ? Math.round((npsData.detractors / totalResponses) * 100) : 0}%
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {avgRating && !npsData && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgRating}</div>
              <p className="text-xs text-muted-foreground">
                out of {survey.type === 'csat' ? '5' : '10'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* NPS Trend Chart */}
      {survey.type === 'nps' && allResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>NPS Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading chart...</div>}>
              <NPSTrendChart responses={allResponses} survey={survey} />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {/* Responses Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Responses ({filteredResponses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsesTable responses={filteredResponses} survey={survey} />
        </CardContent>
      </Card>
    </div>
  )
}
