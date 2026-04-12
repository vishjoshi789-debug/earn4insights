'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Loader2, FileText, Plus, Image, Video, BookOpen, Send,
  AlertTriangle, RotateCcw, X, Tag, Building2, Package, User,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

type MentionType = 'category' | 'brand' | 'product' | 'influencer'

type MentionResult = {
  id: string
  label: string
  type: MentionType
}

type MentionResults = {
  categories: { id: string; name: string; slug: string }[]
  brands: { id: string; name: string }[]
  products: { id: string; name: string }[]
  influencers: { id: string; displayName: string }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDIA_ICONS: Record<string, any> = {
  image: Image,
  video: Video,
  reel: Video,
  article: BookOpen,
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-800' },
  pending_review: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Approved', className: 'bg-blue-100 text-blue-800' },
  published: { label: 'Published', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-600' },
  removed: { label: 'Removed', className: 'bg-gray-200 text-gray-700' },
}

const TAG_PILL: Record<MentionType, string> = {
  category: 'bg-blue-100 text-blue-800',
  brand: 'bg-purple-100 text-purple-800',
  product: 'bg-green-100 text-green-800',
  influencer: 'bg-orange-100 text-orange-800',
}

const TYPE_ICON: Record<MentionType, any> = {
  category: Tag,
  brand: Building2,
  product: Package,
  influencer: User,
}

const TYPE_LABEL: Record<MentionType, string> = {
  category: 'Category',
  brand: 'Brand',
  product: 'Product',
  influencer: 'Influencer',
}

// ─── Tag mention input component ──────────────────────────────────────────────

function TagMentionInput({
  tags,
  onTagsChange,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
}) {
  const [inputValue, setInputValue] = useState('')
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [results, setResults] = useState<MentionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Detect @ trigger and extract query after @
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    const atIdx = val.lastIndexOf('@')
    if (atIdx !== -1) {
      const query = val.slice(atIdx + 1)
      setMentionQuery(query)
      setOpen(true)
      setActiveIndex(0)

      // Debounce API call
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        if (!query) { setResults([]); setLoading(false); return }
        setLoading(true)
        try {
          const res = await fetch(`/api/search/mentions?q=${encodeURIComponent(query)}`)
          if (!res.ok) return
          const data: MentionResults = await res.json()
          const flat: MentionResult[] = [
            ...data.categories.map(c => ({ id: c.id, label: c.name, type: 'category' as MentionType })),
            ...data.brands.map(b => ({ id: b.id, label: b.name, type: 'brand' as MentionType })),
            ...data.products.map(p => ({ id: p.id, label: p.name, type: 'product' as MentionType })),
            ...data.influencers.map(i => ({ id: i.id, label: i.displayName, type: 'influencer' as MentionType })),
          ]
          setResults(flat)
        } catch {
          // silent
        } finally {
          setLoading(false)
        }
      }, 300)
    } else {
      setMentionQuery(null)
      setOpen(false)
      setResults([])
    }
  }

  const selectMention = (item: MentionResult) => {
    const tag = `@${item.label}`
    if (!tags.includes(tag)) {
      onTagsChange([...tags, tag])
    }
    // Clear the @ portion from the input
    const atIdx = inputValue.lastIndexOf('@')
    setInputValue(atIdx !== -1 ? inputValue.slice(0, atIdx) : '')
    setOpen(false)
    setMentionQuery(null)
    setResults([])
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      // Enter on plain text (no @) → add as plain tag
      if (e.key === 'Enter' && inputValue.trim() && !inputValue.includes('@')) {
        e.preventDefault()
        const tag = inputValue.trim()
        if (!tags.includes(tag)) onTagsChange([...tags, tag])
        setInputValue('')
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); selectMention(results[activeIndex]) }
    if (e.key === 'Escape') { setOpen(false) }
  }

  const removeTag = (tag: string) => onTagsChange(tags.filter(t => t !== tag))

  const getTagType = (tag: string): MentionType => {
    // We don't store type metadata, so derive from color by convention
    // plain tags default to 'category' styling
    return 'category'
  }

  // Resolve pill color: tags added via mention get type, plain tags get category color
  const getPillClass = (tag: string) => {
    // All @ tags default to category blue; specific type info not stored in string
    // Could extend by storing type|label but keep it simple for now
    return tag.startsWith('@') ? TAG_PILL.category : 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-2">
      {/* Existing tags as pills */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${getPillClass(tag)}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 hover:opacity-70 rounded-full"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Mention input with popover */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Press @ to tag brands, categories, products or influencers"
          className="text-sm"
        />

        {open && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
            {loading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            ) : results.length === 0 && mentionQuery ? (
              <p className="p-3 text-sm text-muted-foreground">
                No results for &quot;{mentionQuery}&quot;
              </p>
            ) : (
              <ul className="max-h-60 overflow-y-auto py-1">
                {results.map((item, idx) => {
                  const Icon = TYPE_ICON[item.type]
                  return (
                    <li key={`${item.type}-${item.id}`}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent ${idx === activeIndex ? 'bg-accent' : ''}`}
                        onMouseDown={e => { e.preventDefault(); selectMention(item) }}
                        onMouseEnter={() => setActiveIndex(idx)}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-left truncate">@{item.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{TYPE_LABEL[item.type]}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Type @ to mention categories, brands, products or influencers. Press Enter for plain tags.
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InfluencerContentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [resubmitId, setResubmitId] = useState<string | null>(null)
  const [resubmitForm, setResubmitForm] = useState({ title: '', body: '' })
  const [resubmitting, setResubmitting] = useState(false)
  const [form, setForm] = useState({
    title: '',
    body: '',
    mediaType: 'image',
    tags: [] as string[],
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/influencer/content')
      .then(r => r.json())
      .then(data => setPosts(data.posts ?? []))
      .finally(() => setLoading(false))
  }, [status])

  const handleCreate = async () => {
    if (!form.title) { toast.error('Title is required'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/influencer/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body || undefined,
          mediaType: form.mediaType,
          tags: form.tags,
        }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const data = await res.json()
      setPosts(prev => [data.post, ...prev])
      setForm({ title: '', body: '', mediaType: 'image', tags: [] })
      setDialogOpen(false)
      toast.success('Post created as draft')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleSubmitForReview = async (postId: string) => {
    setSubmittingId(postId)
    try {
      const res = await fetch(`/api/influencer/posts/${postId}/submit-review`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit')
      }
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'pending_review' } : p))
      toast.success('Submitted for brand review')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmittingId(null)
    }
  }

  const openResubmit = (post: any) => {
    setResubmitId(post.id)
    setResubmitForm({ title: post.title || '', body: post.body || '' })
  }

  const handleResubmit = async () => {
    if (!resubmitId) return
    setResubmitting(true)
    try {
      const updates: any = {}
      if (resubmitForm.title) updates.title = resubmitForm.title
      if (resubmitForm.body) updates.body = resubmitForm.body
      const res = await fetch(`/api/influencer/posts/${resubmitId}/resubmit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to resubmit')
      }
      const data = await res.json()
      setPosts(prev => prev.map(p => p.id === resubmitId ? { ...p, ...data.post, status: 'pending_review' } : p))
      setResubmitId(null)
      toast.success('Content resubmitted for review')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setResubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-headline flex items-center gap-2">
            <FileText className="h-6 w-6" />
            My Content
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your content posts and deliverables.
          </p>
        </div>

        {/* Create post dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> New Post</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Content Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="post-title">Title *</Label>
                <Input
                  id="post-title"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Post title"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="post-body">Description</Label>
                <Textarea
                  id="post-body"
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  rows={3}
                  placeholder="What is this post about?"
                />
              </div>

              {/* Media Type — FIX 1: explicit bg + text colors so options are visible */}
              <div className="space-y-2">
                <Label htmlFor="post-media-type">Media Type *</Label>
                <select
                  id="post-media-type"
                  required
                  className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.mediaType}
                  onChange={e => setForm(f => ({ ...f, mediaType: e.target.value }))}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="reel">Reel</option>
                  <option value="story">Story</option>
                  <option value="carousel">Carousel</option>
                  <option value="article">Article</option>
                </select>
              </div>

              {/* Tags — FIX 2 & 3: @ mention system */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <TagMentionInput
                  tags={form.tags}
                  onTagsChange={tags => setForm(f => ({ ...f, tags }))}
                />
              </div>

              <Button onClick={handleCreate} disabled={creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Draft
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resubmit dialog */}
      <Dialog open={resubmitId !== null} onOpenChange={open => { if (!open) setResubmitId(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit &amp; Resubmit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={resubmitForm.title} onChange={e => setResubmitForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={resubmitForm.body} onChange={e => setResubmitForm(f => ({ ...f, body: e.target.value }))} rows={4} />
            </div>
            <Button onClick={handleResubmit} disabled={resubmitting} className="w-full">
              {resubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Resubmit for Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post grid */}
      {posts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <FileText className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">No content posts yet</p>
            <p className="text-xs text-muted-foreground">Create your first post to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {posts.map((post: any) => {
            const Icon = MEDIA_ICONS[post.mediaType] ?? FileText
            const badge = STATUS_BADGE[post.status] ?? { label: post.status, className: '' }
            const isDraft = post.status === 'draft'
            const isRejected = post.status === 'rejected'
            const isSubmitting = submittingId === post.id

            return (
              <Card key={post.id} className="hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {post.title}
                    </CardTitle>
                    <div className="flex items-center gap-1.5">
                      {post.resubmissionCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          v{post.resubmissionCount + 1}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.body && <p className="text-xs text-muted-foreground line-clamp-2">{post.body}</p>}

                  {isRejected && post.rejectionReason && (
                    <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-medium text-amber-800">Rejection Reason</p>
                          <p className="text-[11px] text-amber-700 mt-0.5">{post.rejectionReason}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags on card */}
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.map((t: string) => (
                        <span
                          key={t}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            t.startsWith('@') ? TAG_PILL.category : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>

                  {isDraft && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => handleSubmitForReview(post.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Submit for Review
                    </Button>
                  )}

                  {isRejected && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() => openResubmit(post)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Edit &amp; Resubmit
                    </Button>
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
