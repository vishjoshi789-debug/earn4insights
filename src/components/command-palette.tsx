'use client'

import * as React from 'react'
import { Command } from 'cmdk'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard, Package, Trophy, PenSquare, ClipboardList,
  Sparkles, Bell, Users, MessagesSquare, Award, HandCoins,
  MessageSquare, BarChart3, TrendingUp, Activity, Globe,
  AlertCircle, FileText, Upload, Settings, Search, Brain, CreditCard,
} from 'lucide-react'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
  role?: 'brand' | 'consumer'
  keywords?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, keywords: 'home overview' },
  { label: 'Products', href: '/dashboard/products', icon: Package, keywords: 'browse catalog' },
  { label: 'Weekly Top 10', href: '/dashboard/rankings', icon: Trophy, keywords: 'rankings leaderboard' },
  { label: 'Submit Feedback', href: '/dashboard/submit-feedback', icon: PenSquare, role: 'consumer', keywords: 'review rate' },
  { label: 'My Feedback', href: '/dashboard/my-feedback', icon: ClipboardList, role: 'consumer', keywords: 'history reviews' },
  { label: 'For You', href: '/dashboard/recommendations', icon: Sparkles, role: 'consumer', keywords: 'recommendations personalized' },
  { label: 'My Watchlist', href: '/dashboard/watchlist', icon: Bell, role: 'consumer', keywords: 'tracking notifications' },
  { label: 'Rewards', href: '/dashboard/rewards', icon: Award, role: 'consumer', keywords: 'points redeem' },
  { label: 'Payouts', href: '/dashboard/payouts', icon: HandCoins, role: 'consumer', keywords: 'earnings withdraw' },
  { label: 'Feedback Hub', href: '/dashboard/feedback', icon: MessageSquare, role: 'brand', keywords: 'responses reviews' },
  { label: 'Surveys & NPS', href: '/dashboard/surveys', icon: BarChart3, role: 'brand' },
  { label: 'Audience Analytics', href: '/dashboard/analytics', icon: TrendingUp, role: 'brand' },
  { label: 'Feature Insights', href: '/dashboard/analytics/feature-insights', icon: Activity, role: 'brand' },
  { label: 'Consumer Intelligence', href: '/dashboard/analytics/consumer-intelligence', icon: Brain, role: 'brand' },
  { label: 'Category Intelligence', href: '/dashboard/analytics/category-intelligence', icon: Globe, role: 'brand' },
  { label: 'Alerts', href: '/dashboard/alerts', icon: AlertCircle, role: 'brand' },
  { label: 'Product Deep Dive', href: '/dashboard/detailed-analytics', icon: FileText, role: 'brand' },
  { label: 'Import Data', href: '/dashboard/import', icon: Upload, role: 'brand' },
  { label: 'Plans & Pricing', href: '/dashboard/pricing', icon: CreditCard, role: 'brand' },
  { label: 'Social', href: '/dashboard/social', icon: Users, keywords: 'feed posts' },
  { label: 'Community', href: '/dashboard/community', icon: MessagesSquare, keywords: 'forum discussions' },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings, keywords: 'profile account preferences' },
]

type ProductResult = {
  id: string
  name: string
  category: string | null
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [products, setProducts] = React.useState<ProductResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const router = useRouter()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined

  // Ctrl+K / Cmd+K toggle
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Search products when query changes (debounced)
  React.useEffect(() => {
    if (query.length < 2) {
      setProducts([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setProducts(data.results || [])
        }
      } catch {
        // silent
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const navigate = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const visibleNavItems = navItems.filter(
    (item) => !item.role || item.role === userRole
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setQuery('') }}
      />
      {/* Dialog */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-lg px-4">
        <Command
          className="rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
          shouldFilter={true}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, products…"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[300px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              {searching ? 'Searching…' : 'No results found.'}
            </Command.Empty>

            {/* Navigation */}
            <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
              {visibleNavItems.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${item.label} ${item.keywords || ''}`}
                  onSelect={() => navigate(item.href)}
                  className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Product results */}
            {products.length > 0 && (
              <Command.Group heading="Products" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
                {products.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`product ${p.name}`}
                    onSelect={() => navigate(`/dashboard/products/${p.id}`)}
                    className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.category && (
                      <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
