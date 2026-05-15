'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search, ThumbsUp, ThumbsDown, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost } from '@/lib/api-client'
import { ChatMarkdown } from './markdown'

type Article = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  targetRoles: string[]
  tags: string[] | null
  helpfulCount: number
  notHelpfulCount: number
  viewCount: number
}

const CATEGORY_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'getting_started', label: 'Getting Started' },
  { id: 'payments', label: 'Payments' },
  { id: 'account', label: 'Account' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'influencer', label: 'Influencer' },
  { id: 'deals', label: 'Deals' },
  { id: 'community', label: 'Community' },
  { id: 'technical', label: 'Technical' },
]

export function FAQTab({ role }: { role: string }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [voting, setVoting] = useState<Record<string, boolean>>({})

  // Debounced search
  const fetchArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search.trim()) params.set('search', search.trim())
      if (role) params.set('role', role)
      params.set('limit', '20')
      const res = await fetch(`/api/support/faq?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load articles')
        return
      }
      const data = await res.json()
      setArticles(data.articles ?? [])
    } catch (err) {
      console.error('[FAQTab] fetch failed:', err)
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }, [category, role, search])

  useEffect(() => {
    const t = setTimeout(fetchArticles, search ? 250 : 0)
    return () => clearTimeout(t)
  }, [fetchArticles, search])

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  const vote = async (article: Article, helpful: boolean) => {
    if (voting[article.id]) return
    setVoting((v) => ({ ...v, [article.id]: true }))
    try {
      const res = await apiPost(`/api/support/faq/${article.slug}/rate`, { helpful })
      if (res.ok) {
        toast.success(helpful ? 'Thanks for the feedback!' : "Thanks — we'll improve this article.")
        setArticles((arr) =>
          arr.map((a) =>
            a.id === article.id
              ? {
                  ...a,
                  helpfulCount: helpful ? a.helpfulCount + 1 : a.helpfulCount,
                  notHelpfulCount: helpful ? a.notHelpfulCount : a.notHelpfulCount + 1,
                }
              : a
          )
        )
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Could not record your vote')
      }
    } catch (err) {
      console.error('[FAQTab] vote failed:', err)
      toast.error('Network error.')
    } finally {
      setVoting((v) => ({ ...v, [article.id]: false }))
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search + filters */}
      <div className="border-b border-border bg-card px-4 py-3 space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search articles…"
            className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setCategory(opt.id)}
              className={
                'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ' +
                (category === opt.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {error}
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">No articles found</p>
            <p className="text-xs text-muted-foreground">
              {search ? 'Try different keywords.' : 'No articles match this category for your role.'}
            </p>
          </div>
        )}

        {!loading && !error && articles.length > 0 && (
          <ul className="space-y-1.5">
            {articles.map((a) => {
              const isOpen = !!expanded[a.id]
              return (
                <li key={a.id} className="rounded-md border border-border bg-card overflow-hidden">
                  <button
                    onClick={() => toggle(a.id)}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/40 transition-colors"
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{a.title}</span>
                      {!isOpen && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {a.excerpt}
                        </span>
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border px-3 py-3 bg-background">
                      <ChatMarkdown text={a.content} />
                      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
                        <span className="text-[11px] text-muted-foreground mr-1">Was this helpful?</span>
                        <button
                          disabled={voting[a.id]}
                          onClick={() => vote(a, true)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          {a.helpfulCount}
                        </button>
                        <button
                          disabled={voting[a.id]}
                          onClick={() => vote(a, false)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50 transition-colors"
                        >
                          <ThumbsDown className="h-3 w-3" />
                          {a.notHelpfulCount}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
