'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import {
  MessagesSquare, Plus, ThumbsUp, ThumbsDown, MessageCircle, Eye, Pin,
  Lock, Search, Megaphone, HelpCircle, Lightbulb, BarChart3, TrendingUp,
  Filter, ChevronLeft, ChevronRight, Loader2, Send, X
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

type CommunityPost = {
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

function truncateCopy(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1)}…`
}

export default function CommunityPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [queryInput, setQueryInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newType, setNewType] = useState('discussion')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])

  const userRole = (session?.user as any)?.role

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/community/posts?${params}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load community posts')
      }

      setPosts(data.posts || [])
      setTotalPages(Math.max(1, data.pagination?.totalPages || 1))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load community posts'
      setPosts([])
      setTotalPages(1)
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, typeFilter])

  useEffect(() => {
    void loadPosts()
  }, [loadPosts])

  const handleSearch = () => {
    setPage(1)
    setSearchQuery(queryInput.trim())
  }

  const handleClearFilters = () => {
    setPage(1)
    setQueryInput('')
    setSearchQuery('')
    setTypeFilter('all')
  }

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Title and content are required')
      return
    }

    const normalizedPollOptions = pollOptions.map(option => option.trim()).filter(Boolean)
    if (newType === 'poll' && normalizedPollOptions.length < 2) {
      toast.error('Polls need at least two options')
      return
    }

    setSubmitting(true)
    try {
      const body: {
        title: string
        content: string
        postType: string
        pollOptions?: string[]
      } = {
        title: newTitle.trim(),
        content: newContent.trim(),
        postType: newType,
      }

      if (newType === 'poll') {
        body.pollOptions = normalizedPollOptions
      }

      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create post')
      }

      setCreateOpen(false)
      setNewTitle('')
      setNewContent('')
      setNewType('discussion')
      setPollOptions(['', ''])
      toast.success('Post published to the community')
      router.push(`/dashboard/community/${data.post.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create post')
    } finally {
      setSubmitting(false)
    }
  }

  const hasActiveFilters = Boolean(searchQuery) || typeFilter !== 'all'

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground mt-1">Discuss, share tips, and connect with the community</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Post</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a Post</DialogTitle>
              <DialogDescription>Share with the community</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discussion">Discussion</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="tips">Tips & Tricks</SelectItem>
                  <SelectItem value="poll">Poll</SelectItem>
                  {userRole === 'brand' && <SelectItem value="announcement">Announcement</SelectItem>}
                  {userRole === 'brand' && <SelectItem value="ama">AMA</SelectItem>}
                </SelectContent>
              </Select>
              <Input
                placeholder="Title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground text-right">{newTitle.length}/200</p>
              <Textarea
                placeholder="What's on your mind?"
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                rows={4}
                maxLength={10000}
              />
              <p className="text-xs text-muted-foreground text-right">{newContent.length}/10000</p>
              {newType === 'poll' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Poll Options</p>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => {
                          const updated = [...pollOptions]
                          updated[i] = e.target.value
                          setPollOptions(updated)
                        }}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <Button variant="outline" size="sm" onClick={() => setPollOptions([...pollOptions, ''])}>
                      Add Option
                    </Button>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={submitting || !newTitle.trim() || !newContent.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search posts..."
            value={queryInput}
            onChange={e => setQueryInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="discussion">Discussions</SelectItem>
            <SelectItem value="ama">AMA</SelectItem>
            <SelectItem value="announcement">Announcements</SelectItem>
            <SelectItem value="feature_request">Feature Requests</SelectItem>
            <SelectItem value="tips">Tips & Tricks</SelectItem>
            <SelectItem value="poll">Polls</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading community posts...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => void loadPosts()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-muted-foreground">
              {hasActiveFilters
                ? 'No posts matched your current search or filters.'
                : 'No posts yet. Be the first to start a discussion.'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {hasActiveFilters && (
                <Button variant="outline" onClick={handleClearFilters}>
                  Reset Filters
                </Button>
              )}
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Post
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map(post => {
            const meta = POST_TYPE_META[post.postType] || POST_TYPE_META.discussion
            const PostIcon = meta.icon
            return (
              <Link key={post.id} href={`/dashboard/community/${post.id}`}>
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Vote column */}
                      <div className="flex flex-col items-center gap-0.5 text-sm text-muted-foreground min-w-[40px]">
                        <ThumbsUp className="h-4 w-4" />
                        <span className="font-medium">{post.upvotes - post.downvotes}</span>
                        <ThumbsDown className="h-4 w-4" />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {post.isPinned && <Pin className="h-3 w-3 text-amber-500" />}
                          {post.isLocked && <Lock className="h-3 w-3 text-red-500" />}
                          <Badge variant="outline" className={`text-xs ${meta.color}`}>
                            <PostIcon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                          {post.productName && (
                            <Badge variant="secondary" className="text-xs">{post.productName}</Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm truncate">{post.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{truncateCopy(post.body, 160)}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>
                            {post.authorName || 'Anonymous'}
                            {post.authorRole === 'brand' && (
                              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Brand</Badge>
                            )}
                          </span>
                          <span>{formatTimeAgo(post.createdAt)}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{post.replyCount}</span>
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.viewCount}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
