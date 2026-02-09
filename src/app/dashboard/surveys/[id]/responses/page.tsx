import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, TrendingUp, Users, Star } from 'lucide-react'
import { fetchSurvey } from '@/server/surveys/surveyService'
import { calculateNPS } from '@/server/surveys/responseService'
import { getResponsesBySurveyId } from '@/db/repositories/surveyRepository'
import { formatDistanceToNow } from 'date-fns'
import ResponsesTable from './ResponsesTable'
import NPSTrendChart from './NPSTrendChart'
import ExportResponsesButton from './ExportResponsesButton'
import { listFeedbackMediaForOwners } from '@/server/uploads/feedbackMediaRepo'
import ProcessNowButton from './ProcessNowButton'
import ResponseFilters from './ResponseFilters'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    dateFrom?: string
    dateTo?: string
    ratingMin?: string
    ratingMax?: string
    language?: string
    modality?: string
    sentiment?: string
  }>
}

export default async function SurveyResponsesPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const filters = await searchParams
  
  const survey = await fetchSurvey(id)
  if (!survey) notFound()

  const allResponses = await getResponsesBySurveyId(id)

  // Apply filters
  let filteredResponses = allResponses
  
  // Date range filter
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom)
    filteredResponses = filteredResponses.filter(r => new Date(r.submittedAt) >= fromDate)
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo)
    toDate.setHours(23, 59, 59, 999) // End of day
    filteredResponses = filteredResponses.filter(r => new Date(r.submittedAt) <= toDate)
  }

  // Rating range filter
  if (filters.ratingMin) {
    const minRating = parseInt(filters.ratingMin)
    filteredResponses = filteredResponses.filter(r => {
      const score = r.npsScore ?? null
      return score !== null && score >= minRating
    })
  }
  if (filters.ratingMax) {
    const maxRating = parseInt(filters.ratingMax)
    filteredResponses = filteredResponses.filter(r => {
      const score = r.npsScore ?? null
      return score !== null && score <= maxRating
    })
  }

  // Language filter
  if (filters.language && filters.language !== 'all') {
    filteredResponses = filteredResponses.filter(r => r.originalLanguage === filters.language)
  }

  // Modality filter
  if (filters.modality && filters.modality !== 'all') {
    const modalityFilter = filters.modality
    filteredResponses = filteredResponses.filter(r => {
      const modality = (r.modalityPrimary || 'text').toLowerCase()
      return modality === modalityFilter.toLowerCase()
    })
  }

  // Sentiment filter
  if (filters.sentiment && filters.sentiment !== 'all') {
    const sentimentFilter = filters.sentiment
    filteredResponses = filteredResponses.filter(r => {
      const sentiment = (r.sentiment || '').toLowerCase()
      return sentiment === sentimentFilter.toLowerCase()
    })
  }

  const responses = filteredResponses

  const media = await listFeedbackMediaForOwners({
    ownerType: 'survey_response',
    ownerIds: allResponses.map(r => r.id),
  })

  const audioMedia = media.filter(m => String((m as any).mediaType) === 'audio')
  const videoMedia = media.filter(m => String((m as any).mediaType) === 'video')
  const imageMedia = media.filter(m => String((m as any).mediaType) === 'image')

  const audioCounts = audioMedia.reduce<Record<string, number>>((acc, row) => {
    const s = String((row as any).status || '').toLowerCase() || 'unknown'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const videoCounts = videoMedia.reduce<Record<string, number>>((acc, row) => {
    const s = String((row as any).status || '').toLowerCase() || 'unknown'
    acc[s] = (acc[s] || 0) + 1
    return acc
  }, {})

  const processingTimeoutSeconds = Number(process.env.FEEDBACK_MEDIA_PROCESSING_TIMEOUT_SECONDS || 900)
  const processingStaleCutoff = new Date(Date.now() - processingTimeoutSeconds * 1000)
  const staleProcessingCount = audioMedia.filter(m => {
    const status = String((m as any).status || '').toLowerCase()
    const lastAttemptAt = (m as any).lastAttemptAt as Date | null | undefined
    if (status !== 'processing') return false
    if (!lastAttemptAt) return false
    return lastAttemptAt < processingStaleCutoff
  }).length

  const staleVideoProcessingCount = videoMedia.filter(m => {
    const status = String((m as any).status || '').toLowerCase()
    const lastAttemptAt = (m as any).lastAttemptAt as Date | null | undefined
    if (status !== 'processing') return false
    if (!lastAttemptAt) return false
    return lastAttemptAt < processingStaleCutoff
  }).length

  const manualProcessingEnabled = process.env.ALLOW_MANUAL_MEDIA_PROCESSING === 'true'

  const audioMediaByResponseId = media.reduce<Record<string, Array<{
    id: string
    status: string
    durationMs: number | null
    mimeType: string | null
    transcriptText: string | null
    errorCode: string | null
    errorDetail: string | null
    retryCount: number | null
    lastAttemptAt: string | null
    lastErrorAt: string | null
    moderationStatus: string | null
  }>>>((acc, row) => {
    if (String((row as any).mediaType) !== 'audio') return acc
    const list = acc[row.ownerId] || []
    list.push({
      id: String(row.id),
      status: String((row as any).status),
      durationMs: (row as any).durationMs ?? null,
      mimeType: (row as any).mimeType ?? null,
      transcriptText: (row as any).transcriptText ?? null,
      errorCode: (row as any).errorCode ?? null,
      errorDetail: (row as any).errorDetail ?? null,
      retryCount: typeof (row as any).retryCount === 'number' ? (row as any).retryCount : null,
      lastAttemptAt: (row as any).lastAttemptAt ? new Date((row as any).lastAttemptAt).toISOString() : null,
      lastErrorAt: (row as any).lastErrorAt ? new Date((row as any).lastErrorAt).toISOString() : null,
      moderationStatus: (row as any).moderationStatus ? String((row as any).moderationStatus) : null,
    })
    acc[row.ownerId] = list
    return acc
  }, {})

  const videoMediaByResponseId = media.reduce<Record<string, Array<{
    id: string
    status: string
    durationMs: number | null
    mimeType: string | null
    transcriptText: string | null
    errorCode: string | null
    errorDetail: string | null
    retryCount: number | null
    lastAttemptAt: string | null
    lastErrorAt: string | null
    moderationStatus: string | null
  }>>>((acc, row) => {
    if (String((row as any).mediaType) !== 'video') return acc
    const list = acc[row.ownerId] || []
    list.push({
      id: String(row.id),
      status: String((row as any).status),
      durationMs: (row as any).durationMs ?? null,
      mimeType: (row as any).mimeType ?? null,
      transcriptText: (row as any).transcriptText ?? null,
      errorCode: (row as any).errorCode ?? null,
      errorDetail: (row as any).errorDetail ?? null,
      retryCount: typeof (row as any).retryCount === 'number' ? (row as any).retryCount : null,
      lastAttemptAt: (row as any).lastAttemptAt ? new Date((row as any).lastAttemptAt).toISOString() : null,
      lastErrorAt: (row as any).lastErrorAt ? new Date((row as any).lastErrorAt).toISOString() : null,
      moderationStatus: (row as any).moderationStatus ? String((row as any).moderationStatus) : null,
    })
    acc[row.ownerId] = list
    return acc
  }, {})

  const imageMediaByResponseId = media.reduce<Record<string, Array<{
    id: string
    storageKey: string
    mimeType: string | null
    sizeBytes: number | null
    moderationStatus: string | null
  }>>>((acc, row) => {
    if (String((row as any).mediaType) !== 'image') return acc
    const list = acc[row.ownerId] || []
    list.push({
      id: String(row.id),
      storageKey: String((row as any).storageKey || ''),
      mimeType: (row as any).mimeType ?? null,
      sizeBytes: typeof (row as any).sizeBytes === 'number' ? (row as any).sizeBytes : null,
      moderationStatus: (row as any).moderationStatus ? String((row as any).moderationStatus) : null,
    })
    acc[row.ownerId] = list
    return acc
  }, {})

  const availableLanguages = Array.from(
    new Set(allResponses.map(r => r.originalLanguage || 'und'))
  ).sort()

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
        <div className="flex items-center gap-2">
          <ProcessNowButton enabled={manualProcessingEnabled} />
          <ExportResponsesButton surveyId={id} responses={filteredResponses} filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <ResponseFilters
        availableLanguages={availableLanguages}
        totalResponses={allResponses.length}
        filteredCount={filteredResponses.length}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalResponses}</div>
          </CardContent>
        </Card>

        {npsData && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">NPS Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{npsData.score}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Promoters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{npsData.promoters}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Detractors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{npsData.detractors}</div>
              </CardContent>
            </Card>
          </>
        )}

        {avgRating && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center gap-2">
                <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                {avgRating}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Voice Processing Card - keeping original */}
      <Card>
        <CardHeader>
          <CardTitle>Voice processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
              queued: {audioCounts.uploaded || 0}
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              processing: {audioCounts.processing || 0}
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              ready: {audioCounts.ready || 0}
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              failed: {audioCounts.failed || 0}
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
              deleted: {audioCounts.deleted || 0}
            </Badge>
          </div>

          {staleProcessingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {staleProcessingCount} item(s) look stuck (processing &gt; {Math.round(processingTimeoutSeconds / 60)}m). They will be auto re-queued by the processor.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video Processing Card - keeping original */}
      <Card>
        <CardHeader>
          <CardTitle>Video processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
              queued: {videoCounts.uploaded || 0}
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              processing: {videoCounts.processing || 0}
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              ready: {videoCounts.ready || 0}
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              failed: {videoCounts.failed || 0}
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
              deleted: {videoCounts.deleted || 0}
            </Badge>
          </div>

          {staleVideoProcessingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {staleVideoProcessingCount} item(s) look stuck (processing &gt; {Math.round(processingTimeoutSeconds / 60)}m). They will be auto re-queued by the processor.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for old filter form removal */}
      <Card style={{ display: 'none' }}>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid md:grid-cols-4 gap-4" method="get">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <select
                name="sentiment"
                defaultValue={filters.sentiment || ''}
                className="w-full border rounded px-3 py-2 bg-background"
              >
                <option value="">All</option>
                <option value="positive">positive</option>
                <option value="neutral">neutral</option>
                <option value="negative">negative</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Voice processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
              queued: {audioCounts.uploaded || 0}
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              processing: {audioCounts.processing || 0}
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              ready: {audioCounts.ready || 0}
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              failed: {audioCounts.failed || 0}
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
              deleted: {audioCounts.deleted || 0}
            </Badge>
          </div>

          {staleProcessingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {staleProcessingCount} item(s) look stuck (processing &gt; {Math.round(processingTimeoutSeconds / 60)}m). They will be auto re-queued by the processor.
            </p>
          )}

          {!manualProcessingEnabled && (
            <p className="text-xs text-muted-foreground">
              Tip: set <code>ALLOW_MANUAL_MEDIA_PROCESSING=true</code> to enable the “Process now” button for debugging.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video processing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
              queued: {videoCounts.uploaded || 0}
            </Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
              processing: {videoCounts.processing || 0}
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              ready: {videoCounts.ready || 0}
            </Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
              failed: {videoCounts.failed || 0}
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
              deleted: {videoCounts.deleted || 0}
            </Badge>
          </div>

          {staleVideoProcessingCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {staleVideoProcessingCount} item(s) look stuck (processing &gt; {Math.round(processingTimeoutSeconds / 60)}m). They will be auto re-queued by the processor.
            </p>
          )}
        </CardContent>
      </Card>

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
          <ResponsesTable
            responses={filteredResponses}
            survey={survey}
            audioMediaByResponseId={audioMediaByResponseId}
            videoMediaByResponseId={videoMediaByResponseId}
            imageMediaByResponseId={imageMediaByResponseId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
