'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Survey, SurveyResponse } from '@/lib/survey-types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDistanceToNow } from 'date-fns'
import { ThumbsUp, ThumbsDown, Minus, ChevronDown, ChevronUp, Headphones, Download, RotateCcw } from 'lucide-react'
import { analyzeSentiment } from '@/server/sentimentService'

type SentimentData = {
  sentiment: 'positive' | 'negative' | 'neutral'
  score: number
  confidence: number
}

type ResponsesTableProps = {
  responses: SurveyResponse[]
  survey: Survey
  audioMediaByResponseId?: Record<string, Array<{
    id: string
    status: string
    durationMs: number | null
    mimeType: string | null
    transcriptText: string | null
    errorCode: string | null
    errorDetail: string | null
    retryCount?: number | null
    lastAttemptAt?: string | null
    lastErrorAt?: string | null
    moderationStatus?: string | null
  }>>
  videoMediaByResponseId?: Record<string, Array<{
    id: string
    status: string
    durationMs: number | null
    mimeType: string | null
    transcriptText: string | null
    errorCode: string | null
    errorDetail: string | null
    retryCount?: number | null
    lastAttemptAt?: string | null
    lastErrorAt?: string | null
    moderationStatus?: string | null
  }>>
}

function ReviewOverrideEditor(props: {
  responseId: string
  initialOriginalLanguage: string | undefined
  initialNormalizedLanguage: string | undefined
  initialNormalizedText: string | undefined
  canClearTranscript: boolean
}) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [originalLanguage, setOriginalLanguage] = useState(props.initialOriginalLanguage || '')
  const [normalizedLanguage, setNormalizedLanguage] = useState(props.initialNormalizedLanguage || '')
  const [normalizedText, setNormalizedText] = useState(props.initialNormalizedText || '')
  const [clearTranscript, setClearTranscript] = useState(false)

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Review / Override (admin)</p>
          <p className="text-xs text-muted-foreground">
            Edits here affect analytics for this response (language, normalized text, sentiment).
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(v => !v)}>
          {isOpen ? 'Hide' : 'Edit'}
        </Button>
      </div>

      {isOpen && (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Original language</Label>
              <Input
                value={originalLanguage}
                onChange={(e) => setOriginalLanguage(e.target.value)}
                placeholder="e.g. en, hi, es, und"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Normalized language</Label>
              <Input
                value={normalizedLanguage}
                onChange={(e) => setNormalizedLanguage(e.target.value)}
                placeholder="e.g. en"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Normalized text (used for analytics)</Label>
            <Textarea
              value={normalizedText}
              onChange={(e) => setNormalizedText(e.target.value)}
              rows={4}
              placeholder="Edit the translated/normalized text to correct errors…"
            />
          </div>

          {props.canClearTranscript && (
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={clearTranscript}
                onChange={(e) => setClearTranscript(e.target.checked)}
                className="mt-1 rounded"
              />
              <div className="space-y-1">
                <p className="text-xs font-medium">Clear transcript text</p>
                <p className="text-xs text-muted-foreground">
                  Hides transcript in dashboard and removes stored transcript for attached audio.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  setIsSaving(true)
                  const res = await fetch(`/api/dashboard/survey-responses/${props.responseId}/review`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      originalLanguage: originalLanguage.trim() || null,
                      normalizedLanguage: normalizedLanguage.trim() || null,
                      normalizedText: normalizedText.trim() || null,
                      recomputeSentiment: true,
                      clearTranscript,
                    }),
                  })
                  if (!res.ok) {
                    const payload = await res.json().catch(() => ({}))
                    throw new Error(payload?.error || 'Save failed')
                  }
                  setClearTranscript(false)
                  router.refresh()
                } catch (e) {
                  console.error(e)
                  alert(e instanceof Error ? e.message : 'Save failed')
                } finally {
                  setIsSaving(false)
                }
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save overrides'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ResponsesTable({ responses, survey, audioMediaByResponseId, videoMediaByResponseId }: ResponsesTableProps) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [audioOpenId, setAudioOpenId] = useState<string | null>(null)
  const [videoOpenId, setVideoOpenId] = useState<string | null>(null)
  const [sentiments, setSentiments] = useState<Map<string, SentimentData>>(new Map())
  const [retryingMediaId, setRetryingMediaId] = useState<string | null>(null)
  
  // Analyze sentiment for text responses
  useEffect(() => {
    const analyzeResponses = async () => {
      const newSentiments = new Map<string, SentimentData>()
      
      for (const response of responses) {
        // Prefer persisted sentiment (computed on submission / processing pipeline)
        if (response.sentiment) {
          newSentiments.set(response.id, {
            sentiment: response.sentiment,
            score: 0,
            confidence: 0,
          })
          continue
        }

        // Fallback for older rows: analyze normalizedText (preferred) or first text answer
        const normalized = (response.normalizedText || '').trim()
        if (normalized) {
          try {
            const sentiment = await analyzeSentiment(normalized)
            newSentiments.set(response.id, sentiment)
          } catch (err) {
            console.error('Sentiment analysis failed:', err)
          }
          continue
        }

        // Find first text answer
        const textQuestion = survey.questions.find(q => q.type === 'text')
        if (textQuestion && typeof response.answers[textQuestion.id] === 'string') {
          const text = String(response.answers[textQuestion.id])
          if (text.trim()) {
            try {
              const sentiment = await analyzeSentiment(text)
              newSentiments.set(response.id, sentiment)
            } catch (err) {
              console.error('Sentiment analysis failed:', err)
            }
          }
        }
      }
      
      setSentiments(newSentiments)
    }
    
    if (responses.length > 0) {
      analyzeResponses()
    }
  }, [responses, survey.questions])
  
  if (responses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No responses yet</p>
      </div>
    )
  }

  const getNPSCategory = (rating: number) => {
    if (rating >= 9) return { label: 'Promoter', color: 'bg-green-100 text-green-800 border-green-200', icon: ThumbsUp }
    if (rating >= 7) return { label: 'Passive', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Minus }
    return { label: 'Detractor', color: 'bg-red-100 text-red-800 border-red-200', icon: ThumbsDown }
  }

  const getRatingQuestion = () => {
    return survey.questions.find(q => q.type === 'rating')
  }

  const getSentimentBadge = (sentiment: SentimentData) => {
    const colors = {
      positive: 'bg-green-100 text-green-800 border-green-200',
      negative: 'bg-red-100 text-red-800 border-red-200',
      neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    }
    
    const emojis = {
      positive: '😊',
      negative: '😞',
      neutral: '😐',
    }
    
    return (
      <Badge className={colors[sentiment.sentiment]} variant="outline">
        {emojis[sentiment.sentiment]} {sentiment.sentiment}
      </Badge>
    )
  }

  const getProcessingBadge = (status: string, label: 'Voice' | 'Video') => {
    const s = status.toLowerCase()
    if (s === 'uploaded') return <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">{label} queued</Badge>
    if (s === 'ready') return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">{label} ready</Badge>
    if (s === 'processing') return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">{label} processing</Badge>
    if (s === 'failed') return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">{label} failed</Badge>
    return <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">{label} {status}</Badge>
  }

  return (
    <div className="space-y-3">
      {responses.map((response) => {
        const isExpanded = expandedId === response.id
        const ratingQuestion = getRatingQuestion()
        const rating = ratingQuestion ? Number(response.answers[ratingQuestion.id]) : null
        const sentiment = sentiments.get(response.id)
        const audioItems = audioMediaByResponseId?.[response.id] || []
        const visibleAudioItems = audioItems.filter(a =>
          String(a.status).toLowerCase() !== 'deleted' &&
          String(a.moderationStatus || '').toLowerCase() !== 'hidden'
        )
        const hasAudio = visibleAudioItems.length > 0
        const firstAudio = hasAudio ? visibleAudioItems[0] : null
        const transcript = response.transcriptText || firstAudio?.transcriptText || ''

        const videoItems = videoMediaByResponseId?.[response.id] || []
        const visibleVideoItems = videoItems.filter(v =>
          String(v.status).toLowerCase() !== 'deleted' &&
          String(v.moderationStatus || '').toLowerCase() !== 'hidden'
        )
        const hiddenVideoItems = videoItems.filter(v => String(v.moderationStatus || '').toLowerCase() === 'hidden')
        const hasVideo = visibleVideoItems.length > 0
        const firstVideo = hasVideo ? visibleVideoItems[0] : null
        const videoTranscript =
          firstVideo?.transcriptText ||
          ((response.modalityPrimary || '').toLowerCase() === 'video' ? (response.transcriptText || '') : '') ||
          ''
        
        let category = null
        if (survey.type === 'nps' && rating !== null) {
          category = getNPSCategory(rating)
        }

        return (
          <Card key={response.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  {/* Rating Display */}
                  {rating !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{rating}</span>
                      <span className="text-sm text-muted-foreground">
                        / {survey.type === 'nps' ? '10' : '5'}
                      </span>
                    </div>
                  )}
                  
                  {/* NPS Category Badge */}
                  {category && (
                    <Badge className={category.color} variant="outline">
                      <category.icon className="w-3 h-3 mr-1" />
                      {category.label}
                    </Badge>
                  )}
                  
                  {/* Sentiment Badge */}
                  {sentiment && getSentimentBadge(sentiment)}

                  {/* Voice processing badge */}
                  {firstAudio?.status && getProcessingBadge(firstAudio.status, 'Voice')}

                  {/* Video processing badge */}
                  {firstVideo?.status && getProcessingBadge(firstVideo.status, 'Video')}
                  
                  {/* Timestamp */}
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(response.submittedAt), { addSuffix: true })}
                  </span>
                </div>

                {/* Voice playback/download (if available and not deleted) */}
                {hasAudio && firstAudio && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAudioOpenId(audioOpenId === response.id ? null : response.id)}
                    >
                      <Headphones className="w-4 h-4 mr-2" />
                      {audioOpenId === response.id ? 'Hide voice' : 'Play voice'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      asChild
                    >
                      <a
                        href={`/api/dashboard/feedback-media/${firstAudio.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                )}

                {/* If audio exists but got deleted by retention */}
                {!hasAudio && audioItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                      Voice deleted (retention)
                    </Badge>
                  </div>
                )}

                {hasAudio && firstAudio && audioOpenId === response.id && (
                  <div className="mt-2">
                    <audio
                      controls
                      preload="none"
                      className="w-full"
                      src={`/api/dashboard/feedback-media/${firstAudio.id}/download`}
                    />
                  </div>
                )}

                {/* Video playback/download + moderation (Phase 2 foundation) */}
                {hasVideo && firstVideo && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setVideoOpenId(videoOpenId === response.id ? null : response.id)}
                    >
                      {videoOpenId === response.id ? 'Hide video' : 'Play video'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      asChild
                    >
                      <a
                        href={`/api/dashboard/feedback-media/${firstVideo.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/dashboard/feedback-media/${firstVideo.id}/moderate`, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ moderationStatus: 'hidden' }),
                          })
                          if (!res.ok) {
                            const payload = await res.json().catch(() => ({}))
                            throw new Error(payload?.error || 'Hide failed')
                          }
                          router.refresh()
                        } catch (e) {
                          console.error(e)
                          alert(e instanceof Error ? e.message : 'Hide failed')
                        }
                      }}
                    >
                      Hide
                    </Button>
                  </div>
                )}

                {hiddenVideoItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
                      Video hidden (moderation)
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const idToUnhide = String(hiddenVideoItems[0].id)
                        try {
                          const res = await fetch(`/api/dashboard/feedback-media/${idToUnhide}/moderate`, {
                            method: 'POST',
                            headers: { 'content-type': 'application/json' },
                            body: JSON.stringify({ moderationStatus: 'visible' }),
                          })
                          if (!res.ok) {
                            const payload = await res.json().catch(() => ({}))
                            throw new Error(payload?.error || 'Unhide failed')
                          }
                          router.refresh()
                        } catch (e) {
                          console.error(e)
                          alert(e instanceof Error ? e.message : 'Unhide failed')
                        }
                      }}
                    >
                      Unhide
                    </Button>
                  </div>
                )}

                {hasVideo && firstVideo && videoOpenId === response.id && (
                  <div className="mt-2">
                    <video
                      controls
                      preload="none"
                      className="w-full rounded"
                      src={`/api/dashboard/feedback-media/${firstVideo.id}/download`}
                    />
                  </div>
                )}

                {/* User Info */}
                {(response.userEmail || response.userName) && (
                  <div className="text-sm text-muted-foreground">
                    {response.userName && <span className="font-medium">{response.userName}</span>}
                    {response.userName && response.userEmail && <span> • </span>}
                    {response.userEmail && <span>{response.userEmail}</span>}
                  </div>
                )}

                {/* Preview of first text answer */}
                {!isExpanded && (
                  <>
                    {Object.entries(response.answers).map(([questionId, answer]) => {
                      const question = survey.questions.find(q => q.id === questionId)
                      if (question?.type === 'text' && typeof answer === 'string' && answer.trim()) {
                        return (
                          <p key={questionId} className="text-sm text-muted-foreground line-clamp-2">
                            "{answer}"
                          </p>
                        )
                      }
                      return null
                    }).filter(Boolean)[0]}
                  </>
                )}

                {/* Expanded View - All Answers */}
                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {/* Voice processing + transcript preview */}
                    {hasAudio && firstAudio && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Voice feedback</p>

                        <div className="flex flex-wrap items-center gap-2">
                          {firstAudio.status && getProcessingBadge(firstAudio.status, 'Voice')}
                          {response.originalLanguage && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              lang: {response.originalLanguage}
                            </Badge>
                          )}
                          {response.normalizedLanguage && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              normalized: {response.normalizedLanguage}
                            </Badge>
                          )}
                          {firstAudio.durationMs != null && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              ~{Math.round(firstAudio.durationMs / 1000)}s
                            </Badge>
                          )}
                          {typeof firstAudio.retryCount === 'number' && firstAudio.retryCount > 0 && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              retries: {firstAudio.retryCount}
                            </Badge>
                          )}
                        </div>

                        {(firstAudio.lastAttemptAt || firstAudio.lastErrorAt) && (
                          <div className="text-xs text-muted-foreground">
                            {firstAudio.lastAttemptAt && (
                              <span>
                                Last attempt {formatDistanceToNow(new Date(firstAudio.lastAttemptAt), { addSuffix: true })}
                              </span>
                            )}
                            {firstAudio.lastAttemptAt && firstAudio.lastErrorAt && <span> • </span>}
                            {firstAudio.lastErrorAt && (
                              <span>
                                Last error {formatDistanceToNow(new Date(firstAudio.lastErrorAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        )}

                        {firstAudio.status?.toLowerCase() === 'failed' && (
                          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                            <p className="text-sm text-destructive font-medium">
                              Processing failed{firstAudio.errorCode ? ` (${firstAudio.errorCode})` : ''}.
                            </p>
                            {firstAudio.errorDetail && (
                              <p className="text-xs text-destructive/80 mt-1 break-words">
                                {firstAudio.errorDetail}
                              </p>
                            )}
                            <div className="mt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    setRetryingMediaId(firstAudio.id)
                                    const res = await fetch(`/api/dashboard/feedback-media/${firstAudio.id}/retry`, {
                                      method: 'POST',
                                    })
                                    if (!res.ok) {
                                      const payload = await res.json().catch(() => ({}))
                                      throw new Error(payload?.error || 'Retry failed')
                                    }
                                    router.refresh()
                                  } catch (e) {
                                    console.error(e)
                                    alert(e instanceof Error ? e.message : 'Retry failed')
                                  } finally {
                                    setRetryingMediaId(null)
                                  }
                                }}
                                disabled={retryingMediaId === firstAudio.id}
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {retryingMediaId === firstAudio.id ? 'Retrying…' : 'Retry processing'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {transcript.trim() && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Transcript</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {transcript}
                            </p>
                          </div>
                        )}

                        {response.normalizedText && response.normalizedText.trim() && response.normalizedText !== transcript && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Normalized text</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {response.normalizedText}
                            </p>
                          </div>
                        )}

                        <ReviewOverrideEditor
                          responseId={response.id}
                          initialOriginalLanguage={response.originalLanguage}
                          initialNormalizedLanguage={response.normalizedLanguage}
                          initialNormalizedText={response.normalizedText}
                          canClearTranscript={Boolean(transcript && transcript.trim())}
                        />
                      </div>
                    )}

                    {/* Video processing + transcript preview */}
                    {hasVideo && firstVideo && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Video feedback</p>

                        <div className="flex flex-wrap items-center gap-2">
                          {firstVideo.status && getProcessingBadge(firstVideo.status, 'Video')}
                          {firstVideo.durationMs != null && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              ~{Math.round(firstVideo.durationMs / 1000)}s
                            </Badge>
                          )}
                          {typeof firstVideo.retryCount === 'number' && firstVideo.retryCount > 0 && (
                            <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                              retries: {firstVideo.retryCount}
                            </Badge>
                          )}
                        </div>

                        {(firstVideo.lastAttemptAt || firstVideo.lastErrorAt) && (
                          <div className="text-xs text-muted-foreground">
                            {firstVideo.lastAttemptAt && (
                              <span>
                                Last attempt {formatDistanceToNow(new Date(firstVideo.lastAttemptAt), { addSuffix: true })}
                              </span>
                            )}
                            {firstVideo.lastAttemptAt && firstVideo.lastErrorAt && <span> • </span>}
                            {firstVideo.lastErrorAt && (
                              <span>
                                Last error {formatDistanceToNow(new Date(firstVideo.lastErrorAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        )}

                        {firstVideo.status?.toLowerCase() === 'failed' && (
                          <div className="p-3 bg-destructive/10 border border-destructive rounded-lg">
                            <p className="text-sm text-destructive font-medium">
                              Processing failed{firstVideo.errorCode ? ` (${firstVideo.errorCode})` : ''}.
                            </p>
                            {firstVideo.errorDetail && (
                              <p className="text-xs text-destructive/80 mt-1 break-words">
                                {firstVideo.errorDetail}
                              </p>
                            )}
                            <div className="mt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    setRetryingMediaId(firstVideo.id)
                                    const res = await fetch(`/api/dashboard/feedback-media/${firstVideo.id}/retry`, {
                                      method: 'POST',
                                    })
                                    if (!res.ok) {
                                      const payload = await res.json().catch(() => ({}))
                                      throw new Error(payload?.error || 'Retry failed')
                                    }
                                    router.refresh()
                                  } catch (e) {
                                    console.error(e)
                                    alert(e instanceof Error ? e.message : 'Retry failed')
                                  } finally {
                                    setRetryingMediaId(null)
                                  }
                                }}
                                disabled={retryingMediaId === firstVideo.id}
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {retryingMediaId === firstVideo.id ? 'Retrying…' : 'Retry processing'}
                              </Button>
                            </div>
                          </div>
                        )}

                        {videoTranscript.trim() && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Transcript</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {videoTranscript}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {survey.questions.map((question) => {
                      const answer = response.answers[question.id]
                      if (!answer) return null

                      return (
                        <div key={question.id}>
                          <p className="text-sm font-medium mb-1">{question.question}</p>
                          <p className="text-sm text-muted-foreground">
                            {typeof answer === 'string' ? answer : JSON.stringify(answer)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Expand/Collapse Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedId(isExpanded ? null : response.id)}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
