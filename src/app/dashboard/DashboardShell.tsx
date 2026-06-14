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
  HelpCircle,
  Lock,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardHeader } from '@/components/dashboard-header'
import { ProductTour } from '@/components/ProductTour'
import { CommandPalette } from '@/components/command-palette'
import { useActiveView } from '@/components/ActiveViewProvider'
import { useEmailVerification } from '@/components/EmailVerificationProvider'
import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { usePresenceChannel } from '@/hooks/usePusher'
import { PRESENCE_DASHBOARD } from '@/lib/pusher-client'

type Role = 'brand' | 'consumer' | 'influencer' | 'admin'

type MenuItem = {
  href: string
  label: string
  icon: any
  tourId: string
  /**
   * If set, only show this item for the given role(s). Omit for all
   * roles. Array form added in 3.5B-fix to support dual-role items
   * — e.g. influencer features that should appear for both a pure
   * `'influencer'` primary role AND a consumer-with-isInfluencer
   * dual-role user (whose primary role is still `'consumer'`).
   */
  role?: Role | Role[]
  /**
   * ER.1 — required capability flag in addition to the role match.
   * Items targeted at multiple roles (e.g. influencer items shown to
   * either a pure influencer OR a dual-role consumer-with-isInfluencer)
   * must also gate on the user's actual capability flag, otherwise a
   * pure consumer with isInfluencer=false would see every influencer
   * item just because `role: ['consumer', 'influencer']` includes
   * 'consumer'. The filter reads the corresponding boolean from
   * session.user (set in auth.config's `authorize` + `signIn` paths).
   * Admin role bypasses this check.
   */
  requiresCapability?: 'isInfluencer' | 'isBrand'
  /**
   * EV.3 — when true AND the user is currently unverified, the
   * sidebar entry renders a small Lock badge with a tooltip ("Verify
   * email to unlock"). The link still navigates; the per-page Layer-2
   * banner + Layer-4 button intercept finish the gating story on the
   * landing page. Hidden once the user verifies (poll via the
   * EmailVerificationProvider context).
   */
  requiresEmailVerified?: boolean
}

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { href: '/dashboard/products', label: 'Products', icon: Package, tourId: 'nav-products' },
  { href: '/dashboard/rankings', label: 'Weekly Top 10 products', icon: Trophy, tourId: 'nav-rankings' },
  // Brand: sees aggregated feedback from consumers
  { href: '/dashboard/feedback', label: 'Feedback Hub', icon: MessageSquare, tourId: 'nav-feedback', role: 'brand', requiresCapability: 'isBrand' },
  // Consumer: submit new feedback + view their history
  { href: '/dashboard/submit-feedback', label: 'Submit Feedback', icon: PenSquare, tourId: 'nav-submit-feedback', role: 'consumer', requiresEmailVerified: true },
  { href: '/dashboard/my-feedback', label: 'My Feedback', icon: ClipboardList, tourId: 'nav-my-feedback', role: 'consumer' },
  { href: '/dashboard/recommendations', label: 'For You', icon: Sparkles, tourId: 'nav-recommendations', role: 'consumer' },
  { href: '/dashboard/watchlist', label: 'My Watchlist', icon: Bell, tourId: 'nav-watchlist', role: 'consumer' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, tourId: 'nav-notifications' },
  { href: '/dashboard/social', label: 'Social', icon: Users, tourId: 'nav-social' },
  { href: '/dashboard/community', label: 'Community', icon: MessagesSquare, tourId: 'nav-community' },
  { href: '/dashboard/deals', label: 'Deals & Offers', icon: Tags, tourId: 'nav-deals', role: 'consumer', requiresEmailVerified: true },
  { href: '/dashboard/community-deals', label: 'Community Deals', icon: Flame, tourId: 'nav-community-deals' },
  { href: '/dashboard/surveys', label: 'Surveys & NPS', icon: BarChart3, tourId: 'nav-surveys', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/analytics', label: 'Audience Analytics', icon: TrendingUp, tourId: 'nav-brand-analytics', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/analytics/feature-insights', label: 'Feature Insights', icon: Activity, tourId: 'nav-feature-insights', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/analytics/consumer-intelligence', label: 'Consumer Intelligence', icon: Brain, tourId: 'nav-consumer-intelligence', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/analytics/weekly-digest', label: 'Weekly Digest', icon: Bell, tourId: 'nav-weekly-digest', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/analytics/category-intelligence', label: 'Category Intelligence', icon: Globe, tourId: 'nav-category-intelligence', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertCircle, tourId: 'nav-alerts', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/brand/icps', label: 'ICP Profiles', icon: Target, tourId: 'nav-icps', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/brand/campaigns', label: 'Influencer Campaigns', icon: Megaphone, tourId: 'nav-brand-campaigns', role: 'brand', requiresCapability: 'isBrand', requiresEmailVerified: true },
  { href: '/dashboard/brand/influencers', label: 'Discover Influencers', icon: UserCheck, tourId: 'nav-discover-influencers', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/brand/content-review', label: 'Content Review', icon: ClipboardCheck, tourId: 'nav-content-review', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/brand/deals', label: 'Manage Deals', icon: Tags, tourId: 'nav-brand-deals', role: 'brand', requiresCapability: 'isBrand' },
  { href: '/dashboard/rewards', label: 'Rewards', icon: Award, tourId: 'nav-rewards', role: 'consumer', requiresEmailVerified: true },
  { href: '/dashboard/payouts', label: 'Cash Out Points', icon: HandCoins, tourId: 'nav-payouts', role: 'consumer' },
  { href: '/dashboard/privacy', label: 'Privacy & Consent', icon: ShieldCheck, tourId: 'nav-privacy', role: 'consumer' },
  { href: '/dashboard/my-signals', label: 'My Signals', icon: Activity, tourId: 'nav-my-signals', role: 'consumer' },
  { href: '/dashboard/my-data', label: 'My Data Export', icon: Download, tourId: 'nav-my-data', role: 'consumer' },
  // Influencer items: visible for both a pure influencer (role='influencer')
  // and a dual-role consumer-with-isInfluencer (role='consumer'). The array
  // form was added in 3.5B-fix; 3.5E will introduce the proper primary-view
  // + role-switcher pattern so dual-role users can hide one set or the other.
  { href: '/dashboard/influencer/profile', label: 'Influencer Profile', icon: UserCheck, tourId: 'nav-influencer-profile', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer' },
  { href: '/dashboard/influencer/marketplace', label: 'Marketplace', icon: Store, tourId: 'nav-influencer-marketplace', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer', requiresEmailVerified: true },
  { href: '/dashboard/influencer/campaigns', label: 'My Campaigns', icon: Megaphone, tourId: 'nav-influencer-campaigns', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer' },
  { href: '/dashboard/influencer/content', label: 'My Content', icon: FileText, tourId: 'nav-influencer-content', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer' },
  { href: '/dashboard/influencer/earnings', label: 'Earnings', icon: Wallet, tourId: 'nav-influencer-earnings', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer' },
  { href: '/dashboard/influencer/payouts', label: 'Payout Accounts', icon: Wallet, tourId: 'nav-influencer-payouts', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer', requiresEmailVerified: true },
  // A9 — Influencer verification page. Email-verified gate carries the 🔒
  // lock when unverified (since the request route is the 8th
  // hard-blocked route). Capability flag keeps the entry off pure
  // consumer sidebars per ER.1.
  { href: '/dashboard/influencer/verification', label: 'Get Verified', icon: ShieldCheck, tourId: 'nav-influencer-verification', role: ['consumer', 'influencer'], requiresCapability: 'isInfluencer', requiresEmailVerified: true },
  {
    href: '/dashboard/detailed-analytics',
    label: 'Product Deep Dive',
    icon: FileText,
    tourId: 'nav-detailed-analytics',
    role: 'brand',
    requiresCapability: 'isBrand',
  },
  {
    href: '/dashboard/launch',
    label: 'Launch Product',
    icon: PackagePlus,
    tourId: 'nav-launch',
    role: 'brand',
    requiresCapability: 'isBrand',
  },
  {
    href: '/dashboard/import',
    label: 'Import Data',
    icon: Upload,
    tourId: 'nav-import',
    role: 'brand',
    requiresCapability: 'isBrand',
  },
  {
    href: '/dashboard/pricing',
    label: 'Plans & Pricing',
    icon: CreditCard,
    tourId: 'nav-pricing',
    role: 'brand',
    requiresCapability: 'isBrand',
  },
  // Admin-only nav items — point to /admin/* routes
  { href: '/admin/platform-analytics', label: 'Platform Analytics', icon: BarChart3, tourId: 'nav-admin-platform-analytics', role: 'admin' },
  { href: '/admin/analytics', label: 'Traffic Analytics', icon: BarChart2, tourId: 'nav-admin-analytics', role: 'admin' },
  { href: '/admin/payouts', label: 'Payout Queue', icon: Banknote, tourId: 'nav-admin-payouts', role: 'admin' },
  { href: '/admin/community-deals', label: 'Community Deals', icon: Flame, tourId: 'nav-admin-community-deals', role: 'admin' },
  { href: '/admin/campaigns/schedule', label: 'Campaign Schedule', icon: CalendarClock, tourId: 'nav-admin-campaign-schedule', role: 'admin' },
  { href: '/admin/campaigns/analytics', label: 'Campaign Analytics', icon: TrendingUp, tourId: 'nav-admin-campaign-analytics', role: 'admin' },
  { href: '/admin/send-time-optimization', label: 'Send-Time Optimizer', icon: Timer, tourId: 'nav-admin-send-time', role: 'admin' },
  { href: '/admin/send-time-analytics', label: 'Send-Time Analytics', icon: Activity, tourId: 'nav-admin-send-time-analytics', role: 'admin' },
  { href: '/admin/support', label: 'Support', icon: HelpCircle, tourId: 'nav-admin-support', role: 'admin' },
  // A9 — Admin verification queue. Mirrors the /admin/payouts pattern.
  { href: '/admin/verification-requests', label: 'Verification Queue', icon: ShieldCheck, tourId: 'nav-admin-verification', role: 'admin' },
]

// Items whose sub-paths have their own sidebar entry — use exact match only
const exactMatchRoutes = new Set(['/dashboard/analytics'])

// Inner component — must live inside <SidebarProvider> so useSidebar() works
function SidebarNav({
  visibleItems,
  unreadAlerts,
  pendingVerifications,
}: {
  visibleItems: MenuItem[]
  unreadAlerts: number
  pendingVerifications: number
}) {
  const pathname = usePathname()
  const { isMobile, close } = useSidebar()
  // EV.3 — lock-icon visibility on requiresEmailVerified items.
  // The shared provider in dashboard/layout.tsx polls + revalidates;
  // here we just consume the boolean.
  const { isVerified } = useEmailVerification()

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
          {visibleItems.map((item) => {
            const showLock = !!item.requiresEmailVerified && !isVerified
            const showAlertBadge =
              item.href === '/dashboard/alerts' && unreadAlerts > 0
            const showVerificationBadge =
              item.href === '/admin/verification-requests' && pendingVerifications > 0
            const badgeCount = showAlertBadge ? unreadAlerts : showVerificationBadge ? pendingVerifications : 0
            const showAnyBadge = showAlertBadge || showVerificationBadge
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  tooltip={
                    showLock ? `${item.label} — verify email to unlock` : item.label
                  }
                  data-tour={item.tourId}
                >
                  <Link href={item.href} onClick={handleNavClick}>
                    <item.icon />
                    <span>{item.label}</span>
                    {showLock && (
                      <Lock
                        className="ml-auto h-3.5 w-3.5 text-amber-500/80"
                        aria-label="Email verification required"
                      />
                    )}
                    {showAnyBadge && (
                      <span
                        className={
                          'flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ' +
                          (showLock ? 'ml-1.5' : 'ml-auto')
                        }
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Help Center">
              <Link href="/help" onClick={handleNavClick}>
                <HelpCircle />
                <span>Help Center</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
  const userRole = (session?.user as any)?.role as Role | undefined
  // ER.1 — capability flags drive the requiresCapability gate on items
  // that target multiple roles via array-form `role`. Without these the
  // pure consumer who has isInfluencer=false would still see every
  // influencer item just because the item lists 'consumer' in role[].
  const isInfluencerCap = (session?.user as any)?.isInfluencer === true
  const isBrandCap = (session?.user as any)?.isBrand === true
  // 3.5E — sidebar filters on the ACTIVE view (which may be a
  // session-only toggle, not the stored primary role). Single-role
  // users always see activeView === userRole.
  const { activeView } = useActiveView()
  const userId = (session?.user as any)?.id as string | undefined
  const [unreadAlerts, setUnreadAlerts] = useState(0)
  // A9 — admin verification queue unread count. Mirrors the brand
  // unread-alerts pattern below; surfaces a red count badge on the
  // "Verification Queue" sidebar item so admins notice manual_review
  // rows without having to open the queue page.
  const [pendingVerifications, setPendingVerifications] = useState(0)
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

  // A9 — Poll pending verification-request count for admins. Mirrors
  // the brand alerts pattern above. Fetches the admin queue endpoint
  // (cheap — typically <10 rows) and reads .length. Drives the red
  // count badge on the "Verification Queue" sidebar item.
  useEffect(() => {
    if (userRole !== 'admin') return
    const fetchCount = async () => {
      if (!isVisible.current) return
      try {
        const res = await fetch('/api/admin/verification-requests?status=manual_review')
        if (res.ok) {
          const data = await res.json() as { requests?: unknown[] }
          setPendingVerifications((data.requests ?? []).length)
        }
      } catch { /* silent */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [userRole])

  // Memoize visible items — only recompute when the ACTIVE view
  // changes (3.5E) or the capability flags change (ER.1).
  // Single-role users have activeView === userRole. Dual-role users
  // get adaptive sidebar via the RoleSwitcher. Array.<Role>-form items
  // appear under any role they list, BUT items with
  // `requiresCapability` additionally require the matching boolean
  // flag on the user — closes the "pure consumer sees influencer
  // items" leak from 3.5B-fix. Admin bypasses the capability check.
  const visibleItems = useMemo(
    () => menuItems.filter((item) => {
      if (!item.role) return true
      const rolesAllowed = Array.isArray(item.role) ? item.role : [item.role]
      if (!rolesAllowed.includes(activeView as Role)) return false
      if (item.requiresCapability && activeView !== 'admin') {
        if (item.requiresCapability === 'isInfluencer' && !isInfluencerCap) return false
        if (item.requiresCapability === 'isBrand' && !isBrandCap) return false
      }
      return true
    }),
    [activeView, isInfluencerCap, isBrandCap]
  )

  // While session is loading, show all shared (non-role-specific) items to avoid flicker.
  // After loading, fall back through visibleItems → role-specific filter on activeView.
  const displayItems = useMemo(
    () => status === 'loading' || !activeView
      ? menuItems.filter((item) => !item.role)
      : visibleItems,
    [status, visibleItems, activeView]
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

        <SidebarNav visibleItems={displayItems} unreadAlerts={unreadAlerts} pendingVerifications={pendingVerifications} />
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
