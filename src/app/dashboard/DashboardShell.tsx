'use client'

import { PackagePlus } from 'lucide-react'
import Link from 'next/link'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar'
import { Logo } from '@/components/logo'
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  BarChart3,
  Award,
  Settings,
  Users,
  HandCoins,
  MessagesSquare,
  FileText,
  Trophy,
  TrendingUp,
  Target,
  PenSquare,
  ClipboardCheck,
  ClipboardList,
  Activity,
  Bell,
  Globe,
  Upload,
  Sparkles,
  Brain,
  CreditCard,
  AlertCircle,
  ShieldCheck,
  Download,
  Megaphone,
  UserCheck,
  Wallet,
  Store,
  Tags,
  Flame,
  ShieldAlert,
  BarChart2,
  CalendarClock,
  Timer,
  Banknote,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardHeader } from '@/components/dashboard-header'
import { ProductTour } from '@/components/ProductTour'
import { CommandPalette } from '@/components/command-palette'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { usePresenceChannel } from '@/hooks/usePusher'
import { PRESENCE_DASHBOARD } from '@/lib/pusher-client'

type MenuItem = {
  href: string
  label: string
  icon: any
  tourId: string
  /** If set, only show this item for the given role. Omit for all roles. */
  role?: 'brand' | 'consumer' | 'admin'
}

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { href: '/dashboard/products', label: 'Products', icon: Package, tourId: 'nav-products' },
  { href: '/dashboard/rankings', label: 'Weekly Top 10 products', icon: Trophy, tourId: 'nav-rankings' },
  // Brand: sees aggregated feedback from consumers
  { href: '/dashboard/feedback', label: 'Feedback Hub', icon: MessageSquare, tourId: 'nav-feedback', role: 'brand' },
  // Consumer: submit new feedback + view their history
  { href: '/dashboard/submit-feedback', label: 'Submit Feedback', icon: PenSquare, tourId: 'nav-submit-feedback', role: 'consumer' },
  { href: '/dashboard/my-feedback', label: 'My Feedback', icon: ClipboardList, tourId: 'nav-my-feedback', role: 'consumer' },
  { href: '/dashboard/recommendations', label: 'For You', icon: Sparkles, tourId: 'nav-recommendations', role: 'consumer' },
  { href: '/dashboard/watchlist', label: 'My Watchlist', icon: Bell, tourId: 'nav-watchlist', role: 'consumer' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, tourId: 'nav-notifications' },
  { href: '/dashboard/social', label: 'Social', icon: Users, tourId: 'nav-social' },
  { href: '/dashboard/community', label: 'Community', icon: MessagesSquare, tourId: 'nav-community' },
  { href: '/dashboard/deals', label: 'Deals & Offers', icon: Tags, tourId: 'nav-deals' },
  { href: '/dashboard/community-deals', label: 'Community Deals', icon: Flame, tourId: 'nav-community-deals' },
  { href: '/dashboard/surveys', label: 'Surveys & NPS', icon: BarChart3, tourId: 'nav-surveys', role: 'brand' },
  { href: '/dashboard/analytics', label: 'Audience Analytics', icon: TrendingUp, tourId: 'nav-brand-analytics', role: 'brand' },
  { href: '/dashboard/analytics/feature-insights', label: 'Feature Insights', icon: Activity, tourId: 'nav-feature-insights', role: 'brand' },
  { href: '/dashboard/analytics/consumer-intelligence', label: 'Consumer Intelligence', icon: Brain, tourId: 'nav-consumer-intelligence', role: 'brand' },
  { href: '/dashboard/analytics/weekly-digest', label: 'Weekly Digest', icon: Bell, tourId: 'nav-weekly-digest', role: 'brand' },
  { href: '/dashboard/analytics/category-intelligence', label: 'Category Intelligence', icon: Globe, tourId: 'nav-category-intelligence', role: 'brand' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertCircle, tourId: 'nav-alerts', role: 'brand' },
  { href: '/dashboard/brand/icps', label: 'ICP Profiles', icon: Target, tourId: 'nav-icps', role: 'brand' },
  { href: '/dashboard/brand/campaigns', label: 'Influencer Campaigns', icon: Megaphone, tourId: 'nav-brand-campaigns', role: 'brand' },
  { href: '/dashboard/brand/influencers', label: 'Discover Influencers', icon: UserCheck, tourId: 'nav-discover-influencers', role: 'brand' },
  { href: '/dashboard/brand/content-review', label: 'Content Review', icon: ClipboardCheck, tourId: 'nav-content-review', role: 'brand' },
  { href: '/dashboard/brand/deals', label: 'Manage Deals', icon: Tags, tourId: 'nav-brand-deals', role: 'brand' },
  { href: '/dashboard/rewards', label: 'Rewards', icon: Award, tourId: 'nav-rewards', role: 'consumer' },
  { href: '/dashboard/payouts', label: 'Cash Out Points', icon: HandCoins, tourId: 'nav-payouts', role: 'consumer' },
  { href: '/dashboard/privacy', label: 'Privacy & Consent', icon: ShieldCheck, tourId: 'nav-privacy', role: 'consumer' },
  { href: '/dashboard/my-signals', label: 'My Signals', icon: Activity, tourId: 'nav-my-signals', role: 'consumer' },
  { href: '/dashboard/my-data', label: 'My Data Export', icon: Download, tourId: 'nav-my-data', role: 'consumer' },
  { href: '/dashboard/influencer/profile', label: 'Influencer Profile', icon: UserCheck, tourId: 'nav-influencer-profile', role: 'consumer' },
  { href: '/dashboard/influencer/marketplace', label: 'Marketplace', icon: Store, tourId: 'nav-influencer-marketplace', role: 'consumer' },
  { href: '/dashboard/influencer/campaigns', label: 'My Campaigns', icon: Megaphone, tourId: 'nav-influencer-campaigns', role: 'consumer' },
  { href: '/dashboard/influencer/content', label: 'My Content', icon: FileText, tourId: 'nav-influencer-content', role: 'consumer' },
  { href: '/dashboard/influencer/earnings', label: 'Earnings', icon: Wallet, tourId: 'nav-influencer-earnings', role: 'consumer' },
  { href: '/dashboard/influencer/payouts', label: 'Payout Accounts', icon: Wallet, tourId: 'nav-influencer-payouts', role: 'consumer' },
  {
    href: '/dashboard/detailed-analytics',
    label: 'Product Deep Dive',
    icon: FileText,
    tourId: 'nav-detailed-analytics',
    role: 'brand',
  },
  {
    href: '/dashboard/launch',
    label: 'Launch Product',
    icon: PackagePlus,
    tourId: 'nav-launch',
    role: 'brand',
  },
  {
    href: '/dashboard/import',
    label: 'Import Data',
    icon: Upload,
    tourId: 'nav-import',
    role: 'brand',
  },
  {
    href: '/dashboard/pricing',
    label: 'Plans & Pricing',
    icon: CreditCard,
    tourId: 'nav-pricing',
    role: 'brand',
  },
  // Admin-only nav items — point to /admin/* routes
  { href: '/admin/analytics', label: 'Platform Analytics', icon: BarChart2, tourId: 'nav-admin-analytics', role: 'admin' },
  { href: '/admin/payouts', label: 'Payout Queue', icon: Banknote, tourId: 'nav-admin-payouts', role: 'admin' },
  { href: '/admin/community-deals', label: 'Community Deals', icon: Flame, tourId: 'nav-admin-community-deals', role: 'admin' },
  { href: '/admin/campaigns/schedule', label: 'Campaign Schedule', icon: CalendarClock, tourId: 'nav-admin-campaign-schedule', role: 'admin' },
  { href: '/admin/campaigns/analytics', label: 'Campaign Analytics', icon: TrendingUp, tourId: 'nav-admin-campaign-analytics', role: 'admin' },
  { href: '/admin/send-time-optimization', label: 'Send-Time Optimizer', icon: Timer, tourId: 'nav-admin-send-time', role: 'admin' },
  { href: '/admin/send-time-analytics', label: 'Send-Time Analytics', icon: Activity, tourId: 'nav-admin-send-time-analytics', role: 'admin' },
]

// Items whose sub-paths have their own sidebar entry — use exact match only
const exactMatchRoutes = new Set(['/dashboard/analytics'])

// Inner component — must live inside <SidebarProvider> so useSidebar() works
function SidebarNav({
  visibleItems,
  unreadAlerts,
}: {
  visibleItems: MenuItem[]
  unreadAlerts: number
}) {
  const pathname = usePathname()
  const { isMobile, close } = useSidebar()

  const handleNavClick = () => {
    if (isMobile) close()
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === href
    if (exactMatchRoutes.has(href)) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      <SidebarContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.href)}
                tooltip={item.label}
                data-tour={item.tourId}
              >
                <Link href={item.href} onClick={handleNavClick}>
                  <item.icon />
                  <span>{item.label}</span>
                  {item.href === '/dashboard/alerts' && unreadAlerts > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {unreadAlerts > 99 ? '99+' : unreadAlerts}
                    </span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" data-tour="nav-settings">
              <Link href="/dashboard/settings" onClick={handleNavClick}>
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  )
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | 'admin' | undefined
  const userId = (session?.user as any)?.id as string | undefined
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  const isVisible = useRef(true)

  // Subscribe to the presence channel so this user appears as "online"
  usePresenceChannel(PRESENCE_DASHBOARD, !!userId)

  // Track document visibility to pause polling when tab is hidden
  useEffect(() => {
    const onVisChange = () => { isVisible.current = !document.hidden }
    document.addEventListener('visibilitychange', onVisChange)
    return () => document.removeEventListener('visibilitychange', onVisChange)
  }, [])

  // Poll unread alert count for brands (only when tab is visible)
  useEffect(() => {
    if (userRole !== 'brand') return
    const fetchCount = async () => {
      if (!isVisible.current) return
      try {
        const res = await fetch('/api/brand/alerts?countOnly=true')
        if (res.ok) {
          const data = await res.json()
          setUnreadAlerts(data.unread || 0)
        }
      } catch { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000) // poll every 30s
    return () => clearInterval(interval)
  }, [userRole])

  // Memoize visible items — only recompute when role changes, not every render
  const visibleItems = useMemo(
    () => menuItems.filter((item) => !item.role || item.role === (userRole as string)),
    [userRole]
  )

  // While session is loading, show all shared (non-role-specific) items to avoid flicker
  const displayItems = useMemo(
    () => status === 'loading'
      ? menuItems.filter((item) => !item.role)
      : visibleItems,
    [status, visibleItems]
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col gap-1" data-tour="welcome">
            <div className="flex items-center gap-2">
              <Logo size={48} />
              <span className="text-lg font-headline font-semibold">
                Earn4Insights
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarNav visibleItems={displayItems} unreadAlerts={unreadAlerts} />
      </Sidebar>

      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>

      <ProductTour />
      <CommandPalette />
    </SidebarProvider>
  )
}
