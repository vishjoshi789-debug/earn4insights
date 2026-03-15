'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarTrigger, useSidebar } from './ui/sidebar';
import {
  User,
  Bell,
  CheckCheck,
  MessageSquare,
  BarChart3,
  AlertCircle,
  TrendingUp,
  Eye,
  Zap,
  Star,
  ClipboardList,
  Loader2,
  Inbox,
  LogOut,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { signOut, useSession } from 'next-auth/react';
import { formatDistanceToNow } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────────

type BrandAlert = {
  id: string
  alertType: string
  title: string
  body: string
  status: string
  createdAt: string
}

type ConsumerNotification = {
  id: string
  type: string
  subject: string | null
  body: string
  status: string
  createdAt: string
  metadata: Record<string, any> | null
}

// ── Per-type icon config ───────────────────────────────────────────

const brandAlertIcon: Record<string, { icon: React.ElementType; color: string }> = {
  new_feedback:          { icon: MessageSquare, color: 'text-blue-500' },
  negative_feedback:     { icon: AlertCircle,   color: 'text-red-500' },
  survey_complete:       { icon: BarChart3,      color: 'text-green-500' },
  high_intent_consumer:  { icon: TrendingUp,     color: 'text-purple-500' },
  watchlist_milestone:   { icon: Eye,            color: 'text-amber-500' },
  frustration_spike:     { icon: Zap,            color: 'text-orange-500' },
}

const consumerNotifIcon: Record<string, { icon: React.ElementType; color: string }> = {
  new_survey:    { icon: ClipboardList, color: 'text-blue-500' },
  weekly_digest: { icon: BarChart3,     color: 'text-purple-500' },
  survey_submitted: { icon: CheckCheck, color: 'text-green-500' },
  reward_earned: { icon: Star,          color: 'text-yellow-500' },
}

// ── Bell Dropdown (fetches real data) ─────────────────────────────

function NotificationDropdown({ userRole }: { userRole: 'brand' | 'consumer' | undefined }) {
  const isBrand = userRole === 'brand'

  const [open, setOpen] = React.useState(false)
  const [items, setItems] = React.useState<(BrandAlert | ConsumerNotification)[]>([])
  const [unread, setUnread] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)

  // For consumers: track "last opened" in localStorage to derive unread count
  const markConsumerRead = React.useCallback(() => {
    if (!isBrand) {
      localStorage.setItem('notif_last_read', new Date().toISOString())
      setUnread(0)
    }
  }, [isBrand])

  const fetchNotifications = React.useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      if (isBrand) {
        const res = await fetch('/api/brand/alerts?limit=10')
        if (res.ok) {
          const data = await res.json()
          setItems(data.alerts || [])
          setUnread(data.unread || 0)
        }
      } else {
        const res = await fetch('/api/consumer/notifications')
        if (res.ok) {
          const data = await res.json()
          const notifs: ConsumerNotification[] = data.notifications || []
          setItems(notifs)
          // Unread = items newer than last-read timestamp
          const lastRead = localStorage.getItem('notif_last_read')
          const cutoff = lastRead ? new Date(lastRead) : new Date(0)
          setUnread(notifs.filter((n) => new Date(n.createdAt) > cutoff).length)
        }
      }
    } catch { /* silent */ }
    finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [isBrand, loading])

  // Fetch on mount when role is known
  React.useEffect(() => {
    if (userRole) fetchNotifications()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole])

  // Re-fetch + mark read when dropdown opens
  React.useEffect(() => {
    if (open) {
      fetchNotifications()
      if (!isBrand) markConsumerRead()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function markBrandAllRead() {
    await fetch('/api/brand/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    setItems((prev) =>
      prev.map((item) => ({ ...item, status: 'read' })),
    )
    setUnread(0)
  }

  function renderBrandItem(alert: BrandAlert) {
    const cfg = brandAlertIcon[alert.alertType] || { icon: Bell, color: 'text-muted-foreground' }
    const Icon = cfg.icon
    const isUnread = alert.status !== 'read'
    return (
      <React.Fragment key={alert.id}>
        <DropdownMenuItem
          className={`flex items-start gap-3 cursor-default ${isUnread ? 'bg-primary/[0.03]' : ''}`}
          onSelect={(e) => e.preventDefault()}
        >
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
          <div className="grid gap-0.5 min-w-0">
            <p className={`text-sm font-medium leading-snug ${isUnread ? '' : 'text-muted-foreground'}`}>
              {alert.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">{alert.body}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
            </p>
          </div>
          {isUnread && (
            <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </React.Fragment>
    )
  }

  function renderConsumerItem(notif: ConsumerNotification) {
    const cfg = consumerNotifIcon[notif.type] || { icon: Bell, color: 'text-muted-foreground' }
    const Icon = cfg.icon
    const lastRead = typeof window !== 'undefined' ? localStorage.getItem('notif_last_read') : null
    const cutoff = lastRead ? new Date(lastRead) : new Date(0)
    // Since we mark read on open, items are read after the dropdown was opened
    const isUnread = new Date(notif.createdAt) > cutoff
    return (
      <React.Fragment key={notif.id}>
        <DropdownMenuItem
          className="flex items-start gap-3 cursor-default"
          onSelect={(e) => e.preventDefault()}
        >
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
          <div className="grid gap-0.5 min-w-0">
            <p className="text-sm font-medium leading-snug">
              {notif.subject || notif.type.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {/* Strip HTML tags from body for safe inline display */}
              {notif.body.replace(/<[^>]*>/g, '').trim().slice(0, 100)}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
            </p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
      </React.Fragment>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" data-tour="notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground leading-none">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>Notifications</p>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-80 max-h-[480px] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {isBrand && unread > 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={markBrandAllRead}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading && !loaded ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications yet</p>
          </div>
        ) : (
          <>
            {isBrand
              ? (items as BrandAlert[]).map(renderBrandItem)
              : (items as ConsumerNotification[]).map(renderConsumerItem)}
            <DropdownMenuItem asChild>
              <Link
                href={isBrand ? '/dashboard/alerts' : '/dashboard/my-feedback'}
                className="justify-center text-xs text-muted-foreground hover:text-foreground w-full"
              >
                View all →
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main Header ────────────────────────────────────────────────────

export function DashboardHeader() {
  const { isMobile } = useSidebar();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined

  const user = {
    name: session?.user?.name || 'User',
    email: session?.user?.email || 'user@example.com',
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
      {isMobile && <SidebarTrigger />}

      <div className="flex-1 text-xl font-headline font-semibold tracking-tight" />

      <TooltipProvider>
        <NotificationDropdown userRole={userRole} />

        <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground"
                  data-tour="user-menu"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src="/avatars/01.png" alt={user.name} />
                    <AvatarFallback>
                      <User />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>My Account</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setUserMenuOpen(false);
                if (typeof window !== 'undefined' && (window as any).__startProductTour) {
                  (window as any).__startProductTour();
                }
              }}
              className="cursor-pointer"
            >
              <Sparkles className="mr-2 h-4 w-4 text-purple-500" />
              Restart Product Tour
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-red-600 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    </header>
  );
}


