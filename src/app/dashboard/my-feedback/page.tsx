'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList, Star, MessageSquare, Loader2,
  ThumbsUp, ThumbsDown, Minus, PenSquare, Clock,
  CheckCircle2, Eye, Mic, Camera, Globe, Video
} from 'lucide-react'
import Link from 'next/link'

interface FeedbackItem {
  id: string
  productId: string
  productName: string | null
  feedbackText: string
  rating: number | null
  sentiment: string | null
  category: string | null
  status: string
  createdAt: string
  modalityPrimary: string
  originalLanguage: string | null
}

interface Stats {
  totalCount: number
  avgRating: number | null
  positiveCount: number
  neutralCount: number
  negativeCount: number
}

export default function MyFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyFeedback()
  }, [])

  const fetchMyFeedback = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/feedback/my')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setFeedbackList(data.feedback || [])
      setStats(data.stats || null)
    } catch (err) {
      console.error('Fetch error:', err)
      setError('Failed to load your feedback history.')
    } finally {
      setLoading(false)
    }
  }

  const getSentimentIcon = (sentiment: string | null) => {
    if (sentiment === 'positive') return <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-400" />
    if (sentiment === 'negative') return <ThumbsDown className="w-4 h-4 text-red-600 dark:text-red-400" />
    return <Minus className="w-4 h-4 text-gray-500" />
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
      case 'reviewed':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400"><Eye className="w-3 h-3 mr-1" /> Reviewed</Badge>
      case 'addressed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400"><CheckCircle2 className="w-3 h-3 mr-1" /> Addressed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getModalityIcon = (modality: string) => {
    switch (modality) {
      case 'audio': return <Mic className="w-3.5 h-3.5" />
      case 'video': return <Video className="w-3.5 h-3.5" />
      case 'mixed': return <><Mic className="w-3.5 h-3.5" /><Video className="w-3.5 h-3.5" /></>
      default: return <MessageSquare className="w-3.5 h-3.5" />
    }
  }

  const getCategoryLabel = (category: string | null) => {
    const map: Record<string, string> = {
      general: '💬 General',
      praise: '👏 Praise',
      complaint: '😤 Complaint',
      bug: '🐛 Bug',
      'feature-request': '💡 Feature Request',
    }
    return map[category || 'general'] || category
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            My Feedback
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all the feedback you&apos;ve submitted
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/submit-feedback">
            <PenSquare className="w-4 h-4 mr-2" />
            Submit New Feedback
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && stats.totalCount > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submitted</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCount}</div>
              <p className="text-xs text-muted-foreground">feedback submissions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgRating ?? '—'}</div>
              <p className="text-xs text-muted-foreground">out of 5 stars</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.positiveCount}</div>
              <p className="text-xs text-muted-foreground">positive reviews</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Earned</CardTitle>
              <span className="text-lg">🌟</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.totalCount * 25}</div>
              <p className="text-xs text-muted-foreground">from feedback</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-6 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Empty State */}
      {feedbackList.length === 0 && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You haven&apos;t submitted any feedback yet. Start by reviewing a product — you&apos;ll earn reward points for every submission!
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button asChild>
                <Link href="/dashboard/submit-feedback">
                  <PenSquare className="w-4 h-4 mr-2" />
                  Submit Feedback
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/products">Browse Products</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback List */}
      {feedbackList.length > 0 && (
        <div className="space-y-3">
          {feedbackList.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  {/* Left: content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Product name + status */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base truncate">
                        {item.productName || 'Unknown Product'}
                      </h3>
                      {getStatusBadge(item.status)}
                    </div>

                    {/* Feedback text */}
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {item.feedbackText}
                    </p>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {/* Rating */}
                      {item.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                          {item.rating}/5
                        </span>
                      )}

                      {/* Sentiment */}
                      <span className="flex items-center gap-1">
                        {getSentimentIcon(item.sentiment)}
                        {item.sentiment || 'analyzing...'}
                      </span>

                      {/* Category */}
                      <span>{getCategoryLabel(item.category)}</span>

                      {/* Modality */}
                      <span className="flex items-center gap-1">
                        {getModalityIcon(item.modalityPrimary)}
                        {item.modalityPrimary}
                      </span>

                      {/* Language */}
                      {item.originalLanguage && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5" />
                          {item.originalLanguage}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: date + action */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 text-right shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <Button variant="ghost" size="sm" asChild className="text-xs h-7 px-2">
                      <Link href={`/dashboard/submit-feedback?productId=${item.productId}&productName=${encodeURIComponent(item.productName || '')}`}>
                        Review again
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
