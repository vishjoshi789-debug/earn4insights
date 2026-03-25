'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  MessagesSquare, ThumbsUp, ThumbsDown, MessageCircle, Eye, Pin,
  Lock, ArrowLeft, Megaphone, HelpCircle, Lightbulb, BarChart3, TrendingUp,
  Loader2, Send, Trash2, Reply
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type PostDetail = {
  id: string
  authorId: string
  productId: string | null
  title: string
  body: string
  postType: string
  isPinned: boolean
  isLocked: boolean
  upvotes: number
  downvotes: number
  replyCount: number
  viewCount: number
  tags: string[]
  pollOptions: { id: string; text: string; votes: number }[] | null
  createdAt: string
  updatedAt: string
  authorName: string | null
  authorRole: string | null
  productName: string | null
}

type ReplyData = {
  id: string
  postId: string
  authorId: string
  parentReplyId: string | null
  body: string
  upvotes: number
  downvotes: number
  createdAt: string
  authorName: string | null
  authorRole: string | null
}

type UserReaction = {
  postId: string | null
  replyId: string | null
  reactionType: string
}

type PostResponse = {
  post: PostDetail
  replies: ReplyData[]
  userReactions: UserReaction[]
  userPollVoteOptionId: string | null
}

const POST_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  discussion: { label: 'Discussion', icon: MessagesSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  ama: { label: 'AMA', icon: HelpCircle, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  announcement: { label: 'Announcement', icon: Megaphone, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  feature_request: { label: 'Feature Request', icon: TrendingUp, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  tips: { label: 'Tips & Tricks', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  poll: { label: 'Poll', icon: BarChart3, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
}

function formatTimeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function ReplyCard({
  reply,
  childReplies,
  getUserReaction,
  onVote,
  onReplyTo,
  isLocked,
  depth = 0,
}: {
  reply: ReplyData
  childReplies: ReplyData[]
  getUserReaction: (postId: string | null, replyId: string | null) => string | null
  onVote: (postId: string | null, replyId: string | null, type: 'upvote' | 'downvote') => void
  onReplyTo: (replyId: string) => void
  isLocked: boolean
  depth?: number
}) {
  const userReaction = getUserReaction(null, reply.id)
  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-muted pl-4' : ''}>
      <Card className="bg-muted/20">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {reply.authorName || 'Anonymous'}
              {reply.authorRole === 'brand' && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Brand</Badge>
              )}
            </span>
            <span>{formatTimeAgo(reply.createdAt)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => onVote(null, reply.id, 'upvote')}
              aria-label="Upvote reply"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                userReaction === 'upvote' ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'hover:bg-green-50 dark:hover:bg-green-900/30 text-muted-foreground'
              }`}
            >
              <ThumbsUp className="h-3 w-3" />
              {reply.upvotes}
            </button>
            <button
              onClick={() => onVote(null, reply.id, 'downvote')}
              aria-label="Downvote reply"
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                userReaction === 'downvote' ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-muted-foreground'
              }`}
            >
              <ThumbsDown className="h-3 w-3" />
              {reply.downvotes}
            </button>
            {!isLocked && depth < 2 && (
              <button
                onClick={() => onReplyTo(reply.id)}
                aria-label="Reply to comment"
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Reply className="h-3 w-3" />
                Reply
              </button>
            )}
          </div>
        </CardContent>
      </Card>
      {childReplies.length > 0 && (
        <div className="mt-2 space-y-2">
          {childReplies.map(child => (
            <ReplyCard
              key={child.id}
              reply={child}
              childReplies={[]}
              getUserReaction={getUserReaction}
              onVote={onVote}
              onReplyTo={onReplyTo}
              isLocked={isLocked}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { data: session } = useSession()
  const router = useRouter()
  const userId = session?.user?.id

  const [postId, setPostId] = useState<string>('')
  const [post, setPost] = useState<PostDetail | null>(null)
  const [replies, setReplies] = useState<ReplyData[]>([])
  const [userReactions, setUserReactions] = useState<UserReaction[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [votingPoll, setVotingPoll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userPollVoteOptionId, setUserPollVoteOptionId] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setPostId(p.postId))
  }, [params])

  const loadPost = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/community/posts/${postId}`)
      const data = await res.json()

      if (res.ok) {
        const response = data as PostResponse
        setPost(response.post)
        setReplies(response.replies || [])
        setUserReactions(response.userReactions || [])
        setUserPollVoteOptionId(response.userPollVoteOptionId)
      } else if (res.status === 404) {
        router.push('/dashboard/community')
      } else {
        throw new Error(data.error || 'Failed to load post')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load post'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [postId, router])

  useEffect(() => {
    if (postId) {
      void loadPost()
    }
  }, [loadPost, postId])

  const topLevelReplies = replies.filter(r => !r.parentReplyId)
  const getChildReplies = (parentId: string) => replies.filter(r => r.parentReplyId === parentId)

  const getUserReaction = (pId: string | null, rId: string | null) => {
    return userReactions.find(r => r.postId === pId && r.replyId === rId)?.reactionType || null
  }

  const handleVote = async (targetPostId: string | null, replyId: string | null, reactionType: 'upvote' | 'downvote') => {
    try {
      const res = await fetch('/api/community/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: targetPostId, replyId, reactionType }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record reaction')
      }

      void loadPost()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record reaction')
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || !postId) {
      toast.error('Reply content is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyContent.trim(),
          parentReplyId: replyingTo,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post reply')
      }

      setReplyContent('')
      setReplyingTo(null)
      toast.success('Reply posted')
      void loadPost()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/community/posts/${postId}`, { method: 'DELETE' })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete post')
      }

      toast.success('Post deleted')
      router.push('/dashboard/community')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setDeleting(false)
    }
  }

  const handlePollVote = async (optionId: string) => {
    if (userPollVoteOptionId) {
      toast.message('You have already voted on this poll')
      return
    }

    setVotingPoll(true)
    try {
      const res = await fetch('/api/community/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, optionId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record vote')
      }

      if (post) {
        setPost({ ...post, pollOptions: data.pollOptions })
      }
      setUserPollVoteOptionId(optionId)
      toast.success('Vote recorded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record vote')
    } finally {
      setVotingPoll(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Loading post...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
        <Card>
          <CardContent className="p-12 text-center space-y-3 text-muted-foreground">
            <p>{error || 'Post not found.'}</p>
            <Button variant="outline" onClick={() => void loadPost()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const meta = POST_TYPE_META[post.postType] || POST_TYPE_META.discussion
  const PostIcon = meta.icon
  const isAuthor = userId === post.authorId

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
      {/* Back button */}
      <Link href="/dashboard/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>

      {/* Post */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {post.isPinned && <Pin className="h-4 w-4 text-amber-500" />}
                {post.isLocked && <Lock className="h-4 w-4 text-red-500" />}
                <Badge variant="outline" className={`text-xs ${meta.color}`}>
                  <PostIcon className="h-3 w-3 mr-1" />
                  {meta.label}
                </Badge>
                {post.productName && (
                  <Badge variant="secondary" className="text-xs">{post.productName}</Badge>
                )}
              </div>
              <CardTitle className="text-xl">{post.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="font-medium">
                  {post.authorName || 'Anonymous'}
                  {post.authorRole === 'brand' && (
                    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Brand</Badge>
                  )}
                </span>
                <span>{formatTimeAgo(post.createdAt)}</span>
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
              </div>
            </div>
            {isAuthor && (
              <Button variant="ghost" size="icon" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-500" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Post body */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed mb-4">{post.body}</div>

          {/* Poll */}
          {post.postType === 'poll' && post.pollOptions && (
            <div className="space-y-2 my-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold">Poll</p>
                {userPollVoteOptionId && (
                  <Badge variant="secondary" className="text-xs">Vote recorded</Badge>
                )}
              </div>
              {post.pollOptions.map(opt => {
                const totalVotes = post.pollOptions!.reduce((s, o) => s + o.votes, 0)
                const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0
                const isSelected = userPollVoteOptionId === opt.id

                return (
                  <button
                    key={opt.id}
                    aria-label={`Vote for ${opt.text}`}
                    className={`w-full text-left p-2 border rounded-md hover:bg-muted/50 transition-colors relative overflow-hidden ${isSelected ? 'ring-1 ring-indigo-400 border-indigo-300' : ''}`}
                    onClick={() => handlePollVote(opt.id)}
                    disabled={votingPoll || Boolean(userPollVoteOptionId)}
                  >
                    <div className="absolute inset-0 bg-indigo-100 dark:bg-indigo-900/30 transition-all" style={{ width: `${pct}%` }} />
                    <div className="relative flex justify-between items-center gap-3">
                      <span className="text-sm">{opt.text}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {isSelected && <Badge variant="outline" className="text-[10px]">Your vote</Badge>}
                        <span>{opt.votes} votes ({pct}%)</span>
                      </div>
                    </div>
                  </button>
                )
              })}
              {userPollVoteOptionId && (
                <p className="text-xs text-muted-foreground">Poll votes are limited to one choice per user.</p>
              )}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-1 mb-4">
              {(post.tags as string[]).map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Vote bar */}
          <div className="flex items-center gap-4 border-t pt-3">
            <button
              onClick={() => handleVote(post.id, null, 'upvote')}
              aria-label="Upvote post"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                getUserReaction(post.id, null) === 'upvote' ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : 'hover:bg-green-50 dark:hover:bg-green-900/30'
              }`}
            >
              <ThumbsUp className="h-4 w-4" />
              <span className="text-sm">{post.upvotes}</span>
            </button>
            <button
              onClick={() => handleVote(post.id, null, 'downvote')}
              aria-label="Downvote post"
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                getUserReaction(post.id, null) === 'downvote' ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'hover:bg-red-50 dark:hover:bg-red-900/30'
              }`}
            >
              <ThumbsDown className="h-4 w-4" />
              <span className="text-sm">{post.downvotes}</span>
            </button>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <MessageCircle className="h-4 w-4" />
              {post.replyCount} replies
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Reply box */}
      {!post.isLocked && (
        <Card>
          <CardContent className="p-4">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Reply className="h-3 w-3" />
                Replying to a comment
                <button onClick={() => setReplyingTo(null)} aria-label="Cancel reply" className="text-red-500 hover:underline text-xs">Cancel</button>
              </div>
            )}
            <div className="flex gap-3">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                rows={3}
                maxLength={5000}
                className="flex-1"
              />
              <Button
                onClick={handleReply}
                disabled={submitting || !replyContent.trim()}
                size="sm"
                className="self-end"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-2 text-xs text-right text-muted-foreground">{replyContent.length}/5000</p>
          </CardContent>
        </Card>
      )}

      {post.isLocked && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            <Lock className="h-4 w-4 inline mr-1" />
            This thread is locked. No new replies can be added.
          </CardContent>
        </Card>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
          </h3>
          {topLevelReplies.map(reply => (
            <ReplyCard
              key={reply.id}
              reply={reply}
              childReplies={getChildReplies(reply.id)}
              getUserReaction={getUserReaction}
              onVote={handleVote}
              onReplyTo={(replyId) => {
                setReplyingTo(replyId)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              isLocked={post.isLocked}
            />
          ))}
        </div>
      )}

      {replies.length === 0 && !post.isLocked && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No replies yet. Start the conversation.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
