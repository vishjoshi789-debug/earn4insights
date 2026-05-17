'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { MessageCircle, X, MessagesSquare, BookOpen, Ticket as TicketIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePusher } from '@/hooks/usePusher'
import { ChatTab, type ChatRole } from './ChatTab'
import { FAQTab } from './FAQTab'
import { TicketTab } from './TicketTab'

type Tab = 'chat' | 'faq' | 'tickets'

const STORAGE_OPEN = 'e4i-chat-open'
const STORAGE_TAB = 'e4i-chat-tab'
const STORAGE_SEEN = 'e4i-chat-seen'

export function ChatWidget() {
  const { data: session, status } = useSession()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')
  const [hasSeen, setHasSeen] = useState(true)
  const [unread, setUnread] = useState(0)

  // Hydration-safe init: only read sessionStorage on the client after mount.
  useEffect(() => {
    setMounted(true)
    try {
      if (typeof window !== 'undefined') {
        setOpen(sessionStorage.getItem(STORAGE_OPEN) === '1')
        const savedTab = sessionStorage.getItem(STORAGE_TAB) as Tab | null
        if (savedTab === 'chat' || savedTab === 'faq' || savedTab === 'tickets') setTab(savedTab)
        setHasSeen(localStorage.getItem(STORAGE_SEEN) === '1')
      }
    } catch {
      // sessionStorage / localStorage can throw under some privacy modes — ignore.
    }
  }, [])

  // Persist open/tab
  useEffect(() => {
    if (!mounted) return
    try {
      sessionStorage.setItem(STORAGE_OPEN, open ? '1' : '0')
      sessionStorage.setItem(STORAGE_TAB, tab)
    } catch {
      /* noop */
    }
  }, [mounted, open, tab])

  // First open ever → mark as seen so the pulse animation stops on next visit
  useEffect(() => {
    if (!open || hasSeen) return
    try {
      localStorage.setItem(STORAGE_SEEN, '1')
    } catch {
      /* noop */
    }
    setHasSeen(true)
  }, [open, hasSeen])

  // Lock body scroll when full-screen on mobile
  useEffect(() => {
    if (!mounted) return
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
    if (open && isMobile) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [mounted, open])

  const role = useMemo<ChatRole>(() => {
    const sessionRole = (session?.user as any)?.role as string | undefined
    const isInfluencer = (session?.user as any)?.isInfluencer === true
    if (sessionRole === 'brand') return 'brand'
    if (sessionRole === 'admin') return 'consumer' // admins use consumer KB if they open the widget
    if (isInfluencer) return 'influencer'
    return 'consumer'
  }, [session])

  const close = useCallback(() => setOpen(false), [])

  // ── Real-time: subscribe to user's private channel for support events.
  //    Admin reply / resolution / status change → bump unread + toast when
  //    widget is closed.
  const userId = (session?.user as any)?.id as string | undefined
  usePusher({
    channelName: userId ? `private-user-${userId}` : '',
    enabled: !!userId && mounted,
    events: {
      'support.admin_reply': (data: any) => {
        setUnread((n) => n + 1)
        if (!open) {
          toast.message(data?.title ?? 'Support team replied', {
            description: data?.metadata?.ticketNumber
              ? `Ticket ${data.metadata.ticketNumber}`
              : data?.body,
            action: { label: 'View', onClick: () => { setTab('tickets'); setOpen(true) } },
          })
        }
      },
      'support.ticket_resolved': (data: any) => {
        setUnread((n) => n + 1)
        if (!open) {
          toast.message(data?.title ?? 'Ticket resolved', {
            description: 'How did we do? Tap to rate.',
            action: { label: 'Rate', onClick: () => { setTab('tickets'); setOpen(true) } },
          })
        }
      },
      'support.ticket_updated': () => {
        setUnread((n) => n + 1)
      },
    },
  })

  // Reset unread count when user opens the Tickets tab — that's the
  // surface the new pushes are about.
  useEffect(() => {
    if (open && tab === 'tickets') setUnread(0)
  }, [open, tab])

  // Bootstrap the e4i-csrf cookie on first open of the widget. This is
  // a safety net for the production case where Next.js middleware
  // failed to set the cookie on the page load — without this, the
  // first protected POST (chat start, ticket create, etc.) fails with
  // missing_header. The /api/csrf/init route always sets the cookie
  // directly from its route handler, bypassing middleware entirely.
  const [csrfBooted, setCsrfBooted] = useState(false)
  useEffect(() => {
    if (!open || csrfBooted || !mounted) return
    fetch('/api/csrf/init', { credentials: 'same-origin' })
      .then(() => setCsrfBooted(true))
      .catch((err) => {
        console.warn('[ChatWidget] csrf init failed:', err)
        // Still mark as booted — we'll let the API call surface the error.
        setCsrfBooted(true)
      })
  }, [open, csrfBooted, mounted])

  // Don't render anything for unauthenticated users (the widget is dashboard-only,
  // but the dashboard layout could theoretically render before session loads).
  if (!mounted || status !== 'authenticated' || !session?.user?.email) return null

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={unread > 0 ? `Open support chat (${unread} unread)` : 'Open support chat'}
          className={cn(
            'fixed bottom-5 right-5 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 sm:bottom-6 sm:right-6',
            !hasSeen && 'animate-pulse'
          )}
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className={cn(
            'fixed z-[100] flex flex-col bg-card text-foreground shadow-2xl',
            // Mobile: fullscreen
            'inset-0 sm:inset-auto',
            // Desktop: floating panel
            'sm:bottom-6 sm:right-6 sm:h-[640px] sm:max-h-[calc(100vh-3rem)] sm:w-[400px] sm:rounded-xl sm:border sm:border-border'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-primary/95 to-primary/80 px-4 py-3 sm:rounded-t-xl text-primary-foreground">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">Earn4Insights Support</p>
              <p className="text-[11px] opacity-80 leading-tight">We typically reply within 24h</p>
            </div>
            <button
              onClick={close}
              className="rounded-md p-1.5 transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Close support"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 border-b border-border bg-card">
            <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessagesSquare className="h-3.5 w-3.5" />}>
              Chat
            </TabButton>
            <TabButton active={tab === 'faq'} onClick={() => setTab('faq')} icon={<BookOpen className="h-3.5 w-3.5" />}>
              FAQ
            </TabButton>
            <TabButton active={tab === 'tickets'} onClick={() => setTab('tickets')} icon={<TicketIcon className="h-3.5 w-3.5" />}>
              Tickets
            </TabButton>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {!csrfBooted ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div className="space-y-2">
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  <p className="text-xs text-muted-foreground">Setting things up…</p>
                </div>
              </div>
            ) : (
              <>
                {tab === 'chat' && (
                  <ChatTab
                    role={role}
                    onSwitchToFaq={() => setTab('faq')}
                    onEscalated={() => setTab('tickets')}
                  />
                )}
                {tab === 'faq' && <FAQTab role={role} />}
                {tab === 'tickets' && <TicketTab />}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
        active
          ? 'border-b-2 border-primary text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/40'
      )}
    >
      {icon}
      {children}
    </button>
  )
}
