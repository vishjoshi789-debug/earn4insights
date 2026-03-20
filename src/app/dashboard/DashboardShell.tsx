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
  PenSquare,
  ClipboardList,
  Activity,
  Bell,
  Globe,
  Upload,
  Sparkles,
  Brain,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardHeader } from '@/components/dashboard-header'
import { ProductTour } from '@/components/ProductTour'
import { useEffect, useState } from 'react'

type MenuItem = {
  href: string
  label: string
  icon: any
  tourId: string
  /** If set, only show this item for the given role. Omit for all roles. */
  role?: 'brand' | 'consumer'
}

const menuItems: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, tourId: 'nav-dashboard' },
  { href: '/dashboard/products', label: 'Products', icon: Package, tourId: 'nav-products' },
  { href: '/dashboard/rankings', label: 'Weekly Top 10 products', icon: Trophy, tourId: 'nav-rankings' },
  // Brand: sees aggregated feedback from consumers
  { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquare, tourId: 'nav-feedback', role: 'brand' },
  // Consumer: submit new feedback + view their history
  { href: '/dashboard/submit-feedback', label: 'Submit Feedback', icon: PenSquare, tourId: 'nav-submit-feedback', role: 'consumer' },
  { href: '/dashboard/my-feedback', label: 'My Feedback', icon: ClipboardList, tourId: 'nav-my-feedback', role: 'consumer' },
  { href: '/dashboard/recommendations', label: 'For You', icon: Sparkles, tourId: 'nav-recommendations', role: 'consumer' },
  { href: '/dashboard/watchlist', label: 'My Watchlist', icon: Bell, tourId: 'nav-watchlist', role: 'consumer' },
  { href: '/dashboard/social', label: 'Social', icon: Users, tourId: 'nav-social' },
  { href: '/dashboard/community', label: 'Community', icon: MessagesSquare, tourId: 'nav-community' },
  { href: '/dashboard/surveys', label: 'Surveys & NPS', icon: BarChart3, tourId: 'nav-surveys' },
  { href: '/dashboard/analytics', label: 'Brand Analytics', icon: TrendingUp, tourId: 'nav-brand-analytics', role: 'brand' },
  { href: '/dashboard/analytics/unified', label: 'Unified Analytics', icon: TrendingUp, tourId: 'nav-analytics', role: 'brand' },
  { href: '/dashboard/analytics/feature-insights', label: 'Feature Insights', icon: Activity, tourId: 'nav-feature-insights', role: 'brand' },
  { href: '/dashboard/analytics/consumer-intelligence', label: 'Consumer Intelligence', icon: Brain, tourId: 'nav-consumer-intelligence', role: 'brand' },
  { href: '/dashboard/analytics/weekly-digest', label: 'Weekly Digest', icon: Bell, tourId: 'nav-weekly-digest', role: 'brand' },
  { href: '/dashboard/analytics/category-intelligence', label: 'Category Intelligence', icon: Globe, tourId: 'nav-category-intelligence' },
  { href: '/dashboard/alerts', label: 'Alerts', icon: AlertCircle, tourId: 'nav-alerts', role: 'brand' },
  { href: '/dashboard/rewards', label: 'Rewards', icon: Award, tourId: 'nav-rewards', role: 'consumer' },
  { href: '/dashboard/payouts', label: 'Payouts', icon: HandCoins, tourId: 'nav-payouts', role: 'consumer' },
  {
    href: '/dashboard/detailed-analytics',
    label: 'Detailed product analytics',
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
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  // Poll unread alert count for brands
  useEffect(() => {
    if (userRole !== 'brand') return
    const fetchCount = async () => {
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

  // Filter menu items by user role — show items with no role restriction + items matching user's role
  const visibleItems = menuItems.filter(
    (item) => !item.role || item.role === userRole
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex flex-col gap-1" data-tour="welcome">
            <div className="flex items-center gap-2">
              <Logo size={40} />
              <span className="text-lg font-headline font-semibold">
                Earn4Insights
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground leading-tight pl-1">
              Real Voices. Measurable Intelligence.
            </span>
          </div>
        </SidebarHeader>

        <SidebarNav visibleItems={visibleItems} unreadAlerts={unreadAlerts} />
      </Sidebar>

      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>

      <ProductTour />
    </SidebarProvider>
  )
}
