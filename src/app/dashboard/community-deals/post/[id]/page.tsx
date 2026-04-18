'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  ArrowBigUp, ArrowBigDown, MessageSquare, Bookmark, BookmarkCheck,
  Flag, ExternalLink, Copy, Check, Loader2, ArrowLeft, Send, Tag, Clock,
} from 'lucide-react'
import { toast } from 'sonner'

type Post = {
  id: string; authorId: string; authorRole: string; postType: string
  title: string; body: string; imageUrls: string[]
  externalUrl: string | null; promoCode: string | null
  discountDetails: string | null; category: string | null; tags: string[]
  upvoteCount: number; downvoteCount: number; commentCount: number; saveCount: number
  isBrandVerified: boolean; isSponsored: boolean; isFeatured: boolean
  status: string; createdAt: string; userVote?: string | null; isSaved?: boolean
}

type Comment = {
  id: string; postId: string; authorId: string; authorRole: string
  parentCommentId: string | null; body: string; isBrandVerified: boolean
  upvoteCount: number; status: string; createdAt: string
}

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [flagging, setFlagging] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch(`/api/community-deals/posts/${id}`).then(r => r.json()),
      fetch(`/api/community-deals/posts/${id}/comments`).then(r => r.json()),
    ]).then(([postData, commentData]) => {
      setPost(postData.post ?? null)
      setComments(commentData.comments ?? [])
    }).catch(() => toast.error('Failed to load post'))
      .finally(() => setLoading(false))
  }, [id])

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!post) return
    const res = await fetch(`/api/community-deals/posts/${id}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType }),
    })
    if (!res.ok) { toast.error(res.status === 401 ? 'Sign in to vote' : 'Vote failed'); return }

    setPost(p => {
      if (!p) return p
      let upDelta = 0, downDelta = 0
      if (p.userVote === voteType) {
        if (voteType === 'up') upDelta = -1; else downDelta = -1
        return { ...p, userVote: null, upvoteCount: p.upvoteCount + upDelta, downvoteCount: p.downvoteCount + downDelta }
      }
      if (voteType === 'up') { upDelta = 1; if (p.userVote === 'down') downDelta = -1 }
      else { downDelta = 1; if (p.userVote === 'up') upDelta = -1 }
      return { ...p, userVote: voteType, upvoteCount: p.upvoteCount + upDelta, downvoteCount: p.downvoteCount + downDelta }
    })
  }

  const handleSave = async () => {
    const res = await fetch(`/api/community-deals/posts/${id}/save`, { method: 'POST' })
    if (!res.ok) { toast.error('Save failed'); return }
    const data = await res.json()
    setPost(p => p ? { ...p, isSaved: data.saved, saveCount: p.saveCount + (data.saved ? 1 : -1) } : p)
  }

  const handleFlag = async () => {
    setFlagging(true)
    const res = await fetch(`/api/community-deals/posts/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'spam_or_misleading' }),
    })
    setFlagging(false)
    if (res.ok) toast.success('Post flagged for review')
    else {
      const data = await res.json()
      toast.error(data.error || 'Flag failed')
    }
  }

  const handleComment = async () => {
    if (!commentText.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/community-deals/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentText, parentCommentId: replyTo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComments(prev => [...prev, data.comment])
      setCommentText('')
      setReplyTo(null)
      setPost(p => p ? { ...p, commentCount: p.commentCount + 1 } : p)
      toast.success('+5 points!')
    } catch (err: any) {
      toast.error(err.message || 'Comment failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCommentVote = async (commentId: string) => {
    await fetch(`/api/community-deals/posts/${id}/comments/${commentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteType: 'up' }),
    })
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, upvoteCount: c.upvoteCount + 1 } : c
    ))
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Post not found or not yet approved.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" />Go Back
        </Button>
      </div>
    )
  }

  const score = post.upvoteCount - post.downvoteCount

  // Build comment tree
  const topLevel = comments.filter(c => !c.parentCommentId)
  const replies = comments.filter(c => c.parentCommentId)
  const replyMap = new Map<string, Comment[]>()
  replies.forEach(r => {
    const arr = replyMap.get(r.parentCommentId!) ?? []
    arr.push(r)
    replyMap.set(r.parentCommentId!, arr)
  })

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4 md:p-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4 mr-1" />Back
      </Button>

      {/* Post */}
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex gap-4">
            {/* Votes */}
            <div className="flex flex-col items-center gap-0.5">
              <Button
                variant="ghost" size="icon"
                className={`h-8 w-8 ${post.userVote === 'up' ? 'text-orange-400' : 'text-muted-foreground'}`}
                onClick={() => handleVote('up')}
              >
                <ArrowBigUp className="h-6 w-6" />
              </Button>
              <span className={`text-sm font-bold ${score > 0 ? 'text-orange-400' : score < 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                {score}
              </span>
              <Button
                variant="ghost" size="icon"
                className={`h-8 w-8 ${post.userVote === 'down' ? 'text-blue-400' : 'text-muted-foreground'}`}
                onClick={() => handleVote('down')}
              >
                <ArrowBigDown className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {post.isBrandVerified && <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 text-xs">Verified Brand</Badge>}
                {post.isFeatured && <Badge variant="secondary" className="bg-amber-900/50 text-amber-300 text-xs">Featured</Badge>}
                {post.category && <Badge variant="outline" className="text-xs">{post.category}</Badge>}
                <span className="text-xs text-muted-foreground">{getTimeAgo(post.createdAt)}</span>
              </div>

              <h1 className="text-xl font-bold">{post.title}</h1>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.body}</p>

              {post.discountDetails && (
                <p className="text-sm text-emerald-400 font-medium">{post.discountDetails}</p>
              )}

              {post.promoCode && (
                <Button
                  variant="outline"
                  className="border-dashed border-emerald-700 text-emerald-400"
                  onClick={() => {
                    navigator.clipboard.writeText(post.promoCode!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                >
                  {copied ? <><Check className="h-4 w-4 mr-1" />Copied!</> : <><Copy className="h-4 w-4 mr-1" />Code: {post.promoCode}</>}
                </Button>
              )}

              {post.externalUrl && (
                <a href={post.externalUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-400 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />{post.externalUrl}
                </a>
              )}

              {/* Actions bar */}
              <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />{post.commentCount} comments
                </span>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={handleSave}>
                  {post.isSaved ? <BookmarkCheck className="h-4 w-4 text-indigo-400" /> : <Bookmark className="h-4 w-4" />}
                  {post.saveCount} saves
                </button>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={handleFlag} disabled={flagging}>
                  <Flag className="h-4 w-4" />Report
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comment box */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          {replyTo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Replying to comment</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyTo(null)}>
                <ArrowLeft className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              rows={2}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="flex-1"
            />
            <Button
              size="icon"
              className="self-end bg-indigo-600 hover:bg-indigo-500 text-white"
              disabled={!commentText.trim() || submitting}
              onClick={handleComment}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comments */}
      <div className="space-y-2">
        {topLevel.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            replies={replyMap.get(c.id) ?? []}
            onReply={setReplyTo}
            onVote={handleCommentVote}
          />
        ))}
        {comments.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">No comments yet. Be the first!</p>
        )}
      </div>
    </div>
  )
}

function CommentItem({ comment, replies, onReply, onVote }: {
  comment: Comment
  replies: Comment[]
  onReply: (id: string) => void
  onVote: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <Card className="border-border/40">
        <CardContent className="p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {comment.isBrandVerified && <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 text-[10px]">Brand</Badge>}
            <span>{comment.authorRole}</span>
            <span>{getTimeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm">{comment.body}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground" onClick={() => onVote(comment.id)}>
              <ArrowBigUp className="h-3.5 w-3.5" />{comment.upvoteCount}
            </button>
            <button className="hover:text-foreground" onClick={() => onReply(comment.id)}>
              Reply
            </button>
          </div>
        </CardContent>
      </Card>
      {replies.length > 0 && (
        <div className="ml-6 space-y-2 border-l border-border/40 pl-3">
          {replies.map(r => (
            <CommentItem key={r.id} comment={r} replies={[]} onReply={onReply} onVote={onVote} />
          ))}
        </div>
      )}
    </div>
  )
}
