'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, ClipboardCheck, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

type PendingPost = {
  id: string
  title: string
  body: string | null
  mediaType: string
  mediaUrls: string[] | null
  status: string
  reviewSubmittedAt: string
  resubmissionCount: number
  influencerName: string | null
  influencerEmail: string | null
  campaignTitle: string
  campaignId: string
  reviewSlaHours: number | null
  autoApproveEnabled: boolean
  hoursRemaining: number | null
  slaPct: number | null
  slaStatus: 'green' | 'yellow' | 'red' | 'expired' | 'no_sla'
}

const SLA_BADGE: Record<string, { label: string; className: string }> = {
  green: { label: 'On Track', className: 'bg-green-100 text-green-800' },
  yellow: { label: 'Approaching', className: 'bg-yellow-100 text-yellow-800' },
  red: { label: 'Urgent', className: 'bg-red-100 text-red-800' },
  expired: { label: 'SLA Expired', className: 'bg-red-200 text-red-900' },
  no_sla: { label: 'No Deadline', className: 'bg-gray-100 text-gray-600' },
}

export default function BrandContentReviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<PendingPost[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
    if (status === 'authenticated' && (session?.user as any)?.role !== 'brand') router.push('/dashboard')
  }, [status, session, router])

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/brand/content/pending')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      toast.error('Failed to load pending reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchPosts()
  }, [status, fetchPosts])

  const handleApprove = async (postId: string) => {
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/brand/content/${postId}/approve`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve')
      }
      setPosts(prev => prev.filter(p => p.id !== postId))
      toast.success('Content approved and published')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (postId: string) => {
    if (rejectReason.length < 10) {
      toast.error('Rejection reason must be at least 10 characters')
      return
    }
    setActionLoading(postId)
    try {
      const res = await fetch(`/api/brand/content/${postId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reject')
      }
      setPosts(prev => prev.filter(p => p.id !== postId))
      setRejectingId(null)
      setRejectReason('')
      toast.success('Content rejected')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const pendingCount = posts.length
  const approachingCount = posts.filter(p => p.slaStatus === 'yellow' || p.slaStatus === 'red').length
  const expiredCount = posts.filter(p => p.slaStatus === 'expired').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          Content Review
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve influencer content before it goes live.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{approachingCount}</p>
            <p className="text-xs text-muted-foreground">Approaching SLA</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
            <p className="text-xs text-muted-foreground">SLA Expired</p>
          </CardContent>
        </Card>
      </div>

      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <CheckCircle className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground">No content pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const sla = SLA_BADGE[post.slaStatus]
            const isRejecting = rejectingId === post.id
            const isLoading = actionLoading === post.id

            return (
              <Card key={post.id} className="hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{post.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      {post.resubmissionCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          Resubmission #{post.resubmissionCount}
                        </Badge>
                      )}
                      <Badge className={sla.className}>{sla.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>By: {post.influencerName || post.influencerEmail || 'Unknown'}</span>
                    <span>Campaign: {post.campaignTitle}</span>
                    <span>Type: {post.mediaType}</span>
                  </div>

                  {post.body && (
                    <p className="text-xs text-muted-foreground line-clamp-3">{post.body}</p>
                  )}

                  {post.hoursRemaining !== null && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3 w-3" />
                      {post.hoursRemaining > 0 ? (
                        <span>{Math.round(post.hoursRemaining)}h remaining</span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          Overdue by {Math.abs(Math.round(post.hoursRemaining))}h
                        </span>
                      )}
                      {post.autoApproveEnabled && (
                        <span className="text-muted-foreground">(auto-approve enabled)</span>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Submitted {new Date(post.reviewSubmittedAt).toLocaleString()}
                  </p>

                  {isRejecting ? (
                    <div className="space-y-2 border-t pt-3">
                      <Textarea
                        placeholder="Rejection reason (min 10 characters)..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(post.id)}
                          disabled={isLoading || rejectReason.length < 10}
                        >
                          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
                          Confirm Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setRejectingId(null); setRejectReason('') }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApprove(post.id)}
                        disabled={isLoading}
                      >
                        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingId(post.id)}
                        disabled={isLoading}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
