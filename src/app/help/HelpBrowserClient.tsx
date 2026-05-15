'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Rocket,
  CreditCard,
  Package,
  Megaphone,
  Tag,
  Shield,
  BarChart3,
  Wrench,
  ArrowRight,
  Mail,
  MessageCircle,
  X,
} from 'lucide-react'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import type { FaqArticle } from '@/db/schema'

const ROLE_TABS: Array<{ value: 'all' | 'brand' | 'consumer' | 'influencer'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'brand', label: 'For Brands' },
  { value: 'consumer', label: 'For Consumers' },
  { value: 'influencer', label: 'For Influencers' },
]

type CategoryCard = {
  id: FaqArticle['category'] | 'analytics_intel_combined'
  title: string
  icon: React.ComponentType<{ className?: string }>
  /** Categories that roll up into this card (some cards combine related sections). */
  match: FaqArticle['category'][]
}

const CATEGORIES: CategoryCard[] = [
  { id: 'getting_started', title: 'Getting Started', icon: Rocket, match: ['getting_started'] },
  { id: 'payments', title: 'Payments & Billing', icon: CreditCard, match: ['payments', 'billing'] },
  { id: 'feedback', title: 'Products & Surveys', icon: Package, match: ['feedback'] },
  { id: 'campaigns', title: 'Campaigns & Influencers', icon: Megaphone, match: ['campaigns', 'influencer'] },
  { id: 'deals', title: 'Deals & Community', icon: Tag, match: ['deals', 'community'] },
  { id: 'privacy', title: 'Account & Privacy', icon: Shield, match: ['account', 'privacy'] },
  {
    id: 'analytics_intel_combined',
    title: 'Analytics & Intelligence',
    icon: BarChart3,
    match: ['competitive_intel'],
  },
  { id: 'technical', title: 'Technical Support', icon: Wrench, match: ['technical'] },
]

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) =>
    re.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 rounded px-0.5 py-0">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function HelpBrowserClient({
  articles,
  countByCategory,
}: {
  articles: FaqArticle[]
  countByCategory: Record<string, number>
}) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryCard | null>(null)
  const [activeRole, setActiveRole] = useState<typeof ROLE_TABS[number]['value']>('all')
  const [serverHits, setServerHits] = useState<FaqArticle[] | null>(null)
  const [searching, setSearching] = useState(false)

  // Server-side semantic search (debounced) — switches the visible list
  // to ts_rank results when a query is present.
  useEffect(() => {
    if (!search.trim()) {
      setServerHits(null)
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ search: search.trim(), limit: '30' })
        if (activeRole !== 'all') params.set('role', activeRole)
        const res = await fetch(`/api/support/faq?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setServerHits(data.articles ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [search, activeRole])

  // Local filter for category + role (skipped if a search is active).
  const filtered = useMemo(() => {
    if (serverHits) return serverHits
    let list = articles
    if (activeRole !== 'all') {
      list = list.filter(
        (a) => a.targetRoles.length === 0 || a.targetRoles.includes(activeRole)
      )
    }
    if (activeCategory) {
      const set = new Set(activeCategory.match)
      list = list.filter((a) => set.has(a.category))
    }
    return list
  }, [articles, serverHits, activeCategory, activeRole])

  const clearFilters = useCallback(() => {
    setSearch('')
    setActiveCategory(null)
  }, [])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-violet-950/30">
      {/* Hero */}
      <section className="px-4 pt-12 pb-10 md:pt-20 md:pb-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <div className="flex flex-col items-center gap-1">
            <Logo size={48} />
            <span className="font-headline font-bold text-base">Earn4Insights</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">How can we help?</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Search our knowledge base or browse by category.
          </p>
          <div className="relative w-full max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full rounded-full border border-input bg-card py-4 pl-12 pr-12 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category cards — hidden during active search */}
      {!search.trim() && !activeCategory && (
        <section className="px-4 pb-10">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const count = cat.match.reduce((sum, k) => sum + (countByCategory[k] ?? 0), 0)
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat)}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-primary/40"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{cat.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {count} {count === 1 ? 'article' : 'articles'}
                      </p>
                    </div>
                    <span className="mt-auto flex items-center gap-1 text-xs text-primary group-hover:gap-2 transition-all">
                      Browse <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Filter bar (visible when filtering / searching) */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-4xl space-y-3">
          {(activeCategory || search.trim()) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {search.trim()
                  ? <>Results for <strong>&ldquo;{search.trim()}&rdquo;</strong></>
                  : activeCategory
                    ? <>Showing <strong>{activeCategory.title}</strong></>
                    : null}
              </span>
              <button
                onClick={clearFilters}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {ROLE_TABS.map((rt) => (
              <button
                key={rt.value}
                onClick={() => setActiveRole(rt.value)}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
                  (activeRole === rt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:bg-accent')
                }
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Article list */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-4xl">
          {searching && (
            <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
          )}

          {!searching && filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
              <p className="text-sm font-medium">No articles match those filters.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try clearing the filters or searching for something different.
              </p>
            </div>
          )}

          {!searching && filtered.length > 0 && (
            <ul className="space-y-2">
              {filtered.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/help/${a.slug}`}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-base font-semibold text-foreground">
                          {highlight(a.title, search)}
                        </h3>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                          {a.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {highlight(a.excerpt, search)}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 text-center shadow-sm md:p-10">
          <h2 className="text-xl font-bold md:text-2xl">Can&apos;t find what you&apos;re looking for?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Our team is happy to help. Open a support ticket from your dashboard or email us directly.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/dashboard">
                <MessageCircle className="mr-2 h-4 w-4" />
                Open the chat assistant
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="mailto:contact@earn4insights.com">
                <Mail className="mr-2 h-4 w-4" />
                contact@earn4insights.com
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
