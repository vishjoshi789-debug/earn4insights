'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Search, ArrowBigUp, ArrowBigDown, MessageSquare, Bookmark,
  BookmarkCheck, Flag, Plus, Loader2, TrendingUp, Clock,
  ExternalLink, Tag, X, Copy, Check, Flame,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ────────────────────────────────────────────────────────

type Post = {
  id: string
  authorId: string
  authorRole: string
  postType: string
  title: string
  body: string
  imageUrls: string[]
  externalUrl: string | null
  promoCode: string | null
  discountDetails: string | null
  category: string | null
  tags: string[]
  upvoteCount: number
  downvoteCount: number
  commentCount: number
  saveCount: number
  isBrandVerified: boolean
  isSponsored: boolean
  isFeatured: boolean
  status: string
  createdAt: string
  userVote?: string | null
  isSaved?: boolean
}

type Comment = {
  id: string
  postId: string
  authorId: string
  authorRole: string
  parentCommentId: string | null
  body: string
  isBrandVerified: boolean
  upvoteCount: number
  status: string
  createdAt: string
}

// ── Post Card ────────────────────────────────────────────────────

function PostCard({ post, onVote, onSave, onClick }: {
  post: Post
  onVote: (id: string, type: 'up' | 'down') => void
  onSave: (id: string) => void
  onClick: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const score = post.upvoteCount - post.downvoteCount
  const timeAgo = getTimeAgo(post.createdAt)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (post.promoCode) {
      navigator.clipboard.writeText(post.promoCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card
      className="border-border/60 hover:border-border transition-colors cursor-pointer"
      onClick={() => onClick(post.id)}
    >
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Vote column */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${post.userVote === 'up' ? 'text-orange-400' : 'text-muted-foreground'}`}
              onClick={e => { e.stopPropagation(); onVote(post.id, 'up') }}
            >
              <ArrowBigUp className="h-5 w-5" />
            </Button>
            <span className={`text-xs font-bold ${score > 0 ? 'text-orange-400' : score < 0 ? 'text-blue-400' : 'text-muted-foreground'}`}>
              {score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${post.userVote === 'down' ? 'text-blue-400' : 'text-muted-foreground'}`}
              onClick={e => { e.stopPropagation(); onVote(post.id, 'down') }}
            >
              <ArrowBigDown className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {post.isBrandVerified && (
                <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 text-[10px]">Verified</Badge>
              )}
              {post.isFeatured && (
                <Badge variant="secondary" className="bg-amber-900/50 text-amber-300 text-[10px]">Featured</Badge>
              )}
              {post.postType !== 'deal' && (
                <Badge variant="outline" className="text-[10px]">{post.postType}</Badge>
              )}
              <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
            </div>

            <h3 className="font-semibold text-sm leading-tight line-clamp-2">{post.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2">{post.body}</p>

            {/* Promo code pill */}
            {post.promoCode && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-dashed border-emerald-700 text-emerald-400"
                onClick={handleCopy}
              >
                {copied ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />{post.promoCode}</>}
              </Button>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />{post.commentCount}
              </span>
              <button
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={e => { e.stopPropagation(); onSave(post.id) }}
              >
                {post.isSaved
                  ? <BookmarkCheck className="h-3 w-3 text-indigo-400" />
                  : <Bookmark className="h-3 w-3" />}
                {post.saveCount}
              </button>
              {post.category && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />{post.category}
                </span>
              )}
              {post.externalUrl && (
                <a
                  href={post.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink className="h-3 w-3" />Link
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PostSkeleton() {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Skeleton className="h-20 w-8" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function getTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const CATEGORIES = [
  'Electronics', 'Fashion', 'Food & Beverage', 'Health & Beauty',
  'Home & Living', 'Travel', 'Entertainment', 'Education',
  'Finance', 'Sports', 'Automotive', 'Other',
]

const POST_TYPES = [
  { value: 'deal', label: 'Deal' },
  { value: 'question', label: 'Question' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'review', label: 'Review' },
]

// ── Main Page ────────────────────────────────────────────────────

export default function CommunityDealsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Filters
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [postTypeFilter, setPostTypeFilter] = useState('')

  // Create post dialog
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newPost, setNewPost] = useState({
    title: '', body: '', postType: 'deal', promoCode: '',
    externalUrl: '', category: '', discountDetails: '',
  })

  // Load posts
  const loadPosts = useCallback(async (append = false, cursorVal?: string) => {
    if (!append) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (category) params.set('category', category)
      if (postTypeFilter) params.set('postType', postTypeFilter)
      params.set('sort', sortBy)
      if (cursorVal) params.set('cursor', cursorVal)
      params.set('limit', '20')

      const res = await fetch(`/api/community-deals/posts?${params}`)
      const data = await res.json()

      if (append) {
        setPosts(prev => [...prev, ...data.posts])
      } else {
        setPosts(data.posts ?? [])
      }
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    } catch {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [query, category, sortBy, postTypeFilter])

  useEffect(() => { loadPosts() }, [sortBy, category, postTypeFilter]) // eslint-disable-line

  // Actions
  const handleVote = async (postId: string, voteType: 'up' | 'down') => {
    try {
      const res = await fetch(`/api/community-deals/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401) { toast.error('Please sign in to vote'); return }
        throw new Error(data.error)
      }
      // Optimistic update
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p
        const wasUp = p.userVote === 'up'
        const wasDown = p.userVote === 'down'
        let upDelta = 0, downDelta = 0
        if (p.userVote === voteType) {
          // Toggle off
          if (voteType === 'up') upDelta = -1; else downDelta = -1
          return { ...p, userVote: null, upvoteCount: p.upvoteCount + upDelta, downvoteCount: p.downvoteCount + downDelta }
        }
        if (voteType === 'up') { upDelta = 1; if (wasDown) downDelta = -1 }
        else { downDelta = 1; if (wasUp) upDelta = -1 }
        return { ...p, userVote: voteType, upvoteCount: p.upvoteCount + upDelta, downvoteCount: p.downvoteCount + downDelta }
      }))
    } catch { toast.error('Vote failed') }
  }

  const handleSave = async (postId: string) => {
    try {
      const res = await fetch(`/api/community-deals/posts/${postId}/save`, { method: 'POST' })
      if (!res.ok) {
        if (res.status === 401) { toast.error('Please sign in'); return }
        throw new Error()
      }
      const data = await res.json()
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, isSaved: data.saved, saveCount: p.saveCount + (data.saved ? 1 : -1) } : p
      ))
    } catch { toast.error('Save failed') }
  }

  const handleCreate = async () => {
    if (!newPost.title.trim() || !newPost.body.trim()) {
      toast.error('Title and body are required')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/community-deals/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPost.title,
          body: newPost.body,
          postType: newPost.postType,
          promoCode: newPost.promoCode || null,
          externalUrl: newPost.externalUrl || null,
          category: newPost.category || null,
          discountDetails: newPost.discountDetails || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.post.status === 'approved' ? 'Post published!' : 'Post submitted for review')
      setShowCreate(false)
      setNewPost({ title: '', body: '', postType: 'deal', promoCode: '', externalUrl: '', category: '', discountDetails: '' })
      loadPosts()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create post')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Deals</h1>
          <p className="text-muted-foreground text-sm">Share and discover deals from the community</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Plus className="h-4 w-4 mr-1" />Share Deal
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search community deals..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadPosts()}
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            <SelectItem value="newest"><Clock className="h-3 w-3 inline mr-1" />Newest</SelectItem>
            <SelectItem value="top"><TrendingUp className="h-3 w-3 inline mr-1" />Top</SelectItem>
            <SelectItem value="rising"><Flame className="h-3 w-3 inline mr-1" />Rising</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={postTypeFilter} onValueChange={setPostTypeFilter}>
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-background text-foreground">
            <SelectItem value="all">All Types</SelectItem>
            {POST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Post List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)}
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-3">
          {posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              onVote={handleVote}
              onSave={handleSave}
              onClick={id => router.push(`/dashboard/community-deals/post/${id}`)}
            />
          ))}
          {hasMore && (
            <div className="text-center pt-2">
              <Button variant="outline" onClick={() => loadPosts(true, cursor!)}>
                Load More
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No posts yet. Be the first to share a deal!</p>
        </div>
      )}

      {/* Create Post Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share a Deal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Title — e.g. 50% off Nike sneakers"
              value={newPost.title}
              onChange={e => setNewPost(p => ({ ...p, title: e.target.value }))}
            />
            <Textarea
              placeholder="Describe the deal, how you found it, any tips..."
              rows={4}
              value={newPost.body}
              onChange={e => setNewPost(p => ({ ...p, body: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newPost.postType} onValueChange={v => setNewPost(p => ({ ...p, postType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-background text-foreground">
                  {POST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newPost.category} onValueChange={v => setNewPost(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="bg-background text-foreground">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Promo code (optional)"
              value={newPost.promoCode}
              onChange={e => setNewPost(p => ({ ...p, promoCode: e.target.value }))}
            />
            <Input
              placeholder="External link (optional)"
              value={newPost.externalUrl}
              onChange={e => setNewPost(p => ({ ...p, externalUrl: e.target.value }))}
            />
            <Input
              placeholder="Discount details — e.g. 40% off on orders above ₹999"
              value={newPost.discountDetails}
              onChange={e => setNewPost(p => ({ ...p, discountDetails: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="bg-indigo-600 hover:bg-indigo-500 text-white">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
