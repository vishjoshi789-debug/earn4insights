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
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardHeader } from '@/components/dashboard-header'
import { ProductTour } from '@/components/ProductTour'

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
  { href: '/dashboard/social', label: 'Social', icon: Users, tourId: 'nav-social' },
  { href: '/dashboard/community', label: 'Community', icon: MessagesSquare, tourId: 'nav-community' },
  { href: '/dashboard/surveys', label: 'Surveys & NPS', icon: BarChart3, tourId: 'nav-surveys' },
  { href: '/dashboard/analytics/unified', label: 'Unified Analytics', icon: TrendingUp, tourId: 'nav-analytics', role: 'brand' },
  { href: '/dashboard/analytics/feature-insights', label: 'Feature Insights', icon: Activity, tourId: 'nav-feature-insights', role: 'brand' },
  { href: '/dashboard/analytics/weekly-digest', label: 'Weekly Digest', icon: Bell, tourId: 'nav-weekly-digest', role: 'brand' },
  { href: '/dashboard/analytics/category-intelligence', label: 'Category Intelligence', icon: Globe, tourId: 'nav-category-intelligence' },
  { href: '/dashboard/rewards', label: 'Rewards', icon: Award, tourId: 'nav-rewards' },
  { href: '/dashboard/payouts', label: 'Payouts', icon: HandCoins, tourId: 'nav-payouts' },
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
]

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined

  // Filter menu items by user role — show items with no role restriction + items matching user's role
  const visibleItems = menuItems.filter(
    (item) => !item.role || item.role === userRole
  )

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2" data-tour="welcome">
            <Logo />
            <span className="text-lg font-headline font-semibold">
              Earn4Insights
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {visibleItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={
                    item.href === '/dashboard'
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                  }
                  tooltip={item.label}
                  data-tour={item.tourId}
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
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
                <Link href="/dashboard/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>

      <ProductTour />
    </SidebarProvider>
  )
}
