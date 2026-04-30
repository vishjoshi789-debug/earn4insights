'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { X, ChevronRight, ChevronLeft, Sparkles, Rocket, Target, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector for the element to highlight */
  target: string
  /** Title shown in the tooltip */
  title: string
  /** Description / outcome explanation */
  description: string
  /**
   * Which role sees this step (omit = all roles).
   * Influencers use role:'consumer' — they are consumers with is_influencer:true
   * and see all consumer steps including the influencer sub-section.
   */
  role?: 'brand' | 'consumer'
  /** Position of tooltip relative to target */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** If set, navigate to this path before showing step */
  navigateTo?: string
  /** Extra class on tooltip */
  className?: string
  /** Emoji/icon hint */
  icon?: string
}

// ─── Tour Steps ──────────────────────────────────────────────────
//
// Role filtering:
//   omit role  → shown to everyone
//   role:'brand'    → brands only
//   role:'consumer' → consumers AND influencers (influencer = consumer + is_influencer flag)
//
// Order within each role group matters — steps are shown in array order
// after filtering. Keep Welcome first, Finale last.

const TOUR_STEPS: TourStep[] = [

  // ═══════════════════════════════════════════════════════════════
  // ALL USERS
  // ═══════════════════════════════════════════════════════════════

  {
    target: '[data-tour="welcome"]',
    title: '👋 Welcome to Earn4Insights!',
    description: 'This quick tour shows you everything you can do here. Takes under 2 minutes — let\'s go!',
    position: 'bottom',
    icon: '🎉',
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: '🏠 Your Dashboard',
    description: 'Your home base. Personalized recommendations, stats, and quick actions — all at a glance.',
    position: 'right',
  },

  // ═══════════════════════════════════════════════════════════════
  // BRANDS
  // ═══════════════════════════════════════════════════════════════

  {
    target: '[data-tour="nav-products"]',
    title: '📦 Your Products',
    description: 'View and manage all your products. Track performance, see consumer ratings, and monitor engagement in real time.',
    role: 'brand',
    position: 'right',
    icon: '📦',
  },
  {
    target: '[data-tour="nav-launch"]',
    title: '🚀 Launch a New Product',
    description: 'Add a product to the platform. Once live, consumers can discover, review, and rate it — giving you honest, unprompted feedback.',
    role: 'brand',
    position: 'right',
    icon: '🚀',
  },
  {
    target: '[data-tour="nav-surveys"]',
    title: '📊 Surveys & NPS',
    description: 'Create targeted surveys and track your Net Promoter Score. Ask exactly what you need to know, to the right audience.',
    role: 'brand',
    position: 'right',
    icon: '📊',
  },
  {
    target: '[data-tour="nav-feedback"]',
    title: '💬 Consumer Feedback Hub',
    description: 'All consumer feedback in one place — text, audio, and video. AI sentiment analysis tells you what people really feel, not just what they said.',
    role: 'brand',
    position: 'right',
    icon: '💬',
  },
  {
    target: '[data-tour="nav-analytics"]',
    title: '📈 Audience Analytics',
    description: 'Your intelligence command center. Demographics, engagement trends, sentiment, and category comparisons — all in one view.',
    role: 'brand',
    position: 'right',
    icon: '📈',
  },
  {
    target: '[data-tour="nav-consumer-intelligence"]',
    title: '🧠 Consumer Intelligence',
    description: 'Understand how different segments feel about your product and why. Spot behavioral patterns before they become market shifts.',
    role: 'brand',
    position: 'right',
    icon: '🧠',
  },
  {
    target: '[data-tour="nav-feature-insights"]',
    title: '🔍 Feature Insights',
    description: 'See which features delight users and which need work — backed by real feedback data. Stop guessing what to build next.',
    role: 'brand',
    position: 'right',
    icon: '🔍',
  },
  {
    target: '[data-tour="nav-detailed-analytics"]',
    title: '📉 Product Deep Dive',
    description: 'Per-product analytics — sentiment trends over time, score breakdowns, and detailed feedback summaries.',
    role: 'brand',
    position: 'right',
    icon: '📉',
  },
  {
    target: '[data-tour="nav-rankings"]',
    title: '🏆 Weekly Rankings',
    description: 'See how your products rank against competitors each week. Higher rankings = more consumer visibility.',
    role: 'brand',
    position: 'right',
    icon: '🏆',
  },
  {
    target: '[data-tour="nav-alerts"]',
    title: '🔔 Smart Alerts',
    description: 'Get instant notifications when new feedback arrives, rankings change, or a high-match consumer engages with your product. Never miss a signal.',
    role: 'brand',
    position: 'right',
    icon: '🔔',
  },
  {
    target: '[data-tour="nav-icps"]',
    title: '🎯 ICP Profiles',
    description: 'Define your Ideal Consumer Profile with weighted criteria — age, interests, behavior, values, psychographics. The platform scores every consumer against it daily and surfaces the best matches.',
    role: 'brand',
    position: 'right',
    icon: '🎯',
  },
  {
    target: '[data-tour="nav-brand-campaigns"]',
    title: '📣 Influencer Campaigns',
    description: 'Create campaigns, set budgets, define deliverables, and manage milestone-based payments. Funds are escrowed upfront — influencers only get paid when you approve their work.',
    role: 'brand',
    position: 'right',
    icon: '📣',
  },
  {
    target: '[data-tour="nav-discover-influencers"]',
    title: '🔎 Discover Influencers',
    description: 'Search verified influencers by niche, platform, location, and engagement rate. Invite them to your campaign directly — no cold emails needed.',
    role: 'brand',
    position: 'right',
    icon: '🔎',
  },

  // ═══════════════════════════════════════════════════════════════
  // CONSUMERS (including influencers — influencer = consumer + flag)
  // ═══════════════════════════════════════════════════════════════

  {
    target: '[data-tour="nav-products"]',
    title: '🛍️ Discover Products',
    description: 'Browse products from brands looking for your honest opinion. Click "Give Feedback" on any product to start earning!',
    role: 'consumer',
    position: 'right',
    icon: '🛍️',
  },
  {
    target: '[data-tour="nav-submit-feedback"]',
    title: '✍️ Submit Feedback',
    description: 'Your voice matters! Write reviews, record voice or video feedback, upload photos — in any language. Earn points for every submission.',
    role: 'consumer',
    position: 'right',
    icon: '✍️',
  },
  {
    target: '[data-tour="nav-my-feedback"]',
    title: '📋 My Feedback History',
    description: 'Track everything you\'ve submitted — see AI sentiment analysis of your reviews and whether brands have responded.',
    role: 'consumer',
    position: 'right',
    icon: '📋',
  },
  {
    target: '[data-tour="nav-rankings"]',
    title: '🏆 Weekly Top 10',
    description: 'See this week\'s highest-rated products, voted by real consumers like you. Give feedback directly from any ranked product.',
    role: 'consumer',
    position: 'right',
    icon: '🏆',
  },
  {
    target: '[data-tour="nav-surveys"]',
    title: '📋 Take Surveys',
    description: 'Complete brand surveys and share your opinions. Each completed survey earns you points — the more you share, the more you earn.',
    role: 'consumer',
    position: 'right',
    icon: '📋',
  },
  {
    target: '[data-tour="nav-recommendations"]',
    title: '✨ For You',
    description: 'Your hyper-personalized feed powered by your interests, behavior and feedback. Every deal and product shown here is specifically matched to your unique profile. No two feeds look the same.',
    role: 'consumer',
    position: 'right',
    icon: '✨',
  },
  {
    target: '[data-tour="nav-watchlist"]',
    title: '🔖 My Watchlist',
    description: 'Your personal tracker for products, deals and brands you care about. Save anything, then get instant alerts on price drops (coming soon), ranking changes and new reviews — always be first to know.',
    role: 'consumer',
    position: 'right',
    icon: '🔖',
  },
  {
    target: '[data-tour="nav-rewards"]',
    title: '🎁 Your Rewards',
    description: 'Track all your earned points from surveys, reviews, and feedback. Redeem for real rewards and cash payouts.',
    role: 'consumer',
    position: 'right',
    icon: '🎁',
  },
  {
    target: '[data-tour="nav-payouts"]',
    title: '💰 Payouts',
    description: 'Cash out your earnings. Multiple payout methods supported — you get paid for your time and insights.',
    role: 'consumer',
    position: 'right',
    icon: '💰',
  },
  {
    target: '[data-tour="nav-privacy"]',
    title: '🛡️ Privacy & Consent',
    description: 'You control your data. Toggle each category independently — behavioral, demographic, sensitive data. Revoke any consent instantly. GDPR and India DPDP Act compliant.',
    role: 'consumer',
    position: 'right',
    icon: '🛡️',
  },
  {
    target: '[data-tour="nav-my-signals"]',
    title: '📡 My Signals',
    description: 'See exactly what the platform knows about you — behavioral patterns, interests, demographics — with a full history of every update. No hidden data.',
    role: 'consumer',
    position: 'right',
    icon: '📡',
  },
  {
    target: '[data-tour="nav-my-data"]',
    title: '📥 My Data Export',
    description: 'Download everything we hold about you as a single JSON file. Your right under GDPR Article 15 and India\'s DPDP Act. One click, instant export.',
    role: 'consumer',
    position: 'right',
    icon: '📥',
  },

  // ── Influencer sub-section (still role:'consumer') ──────────────
  // These steps introduce the Influencers Adda feature to all consumers.
  // Consumers who have registered as influencers will see these as their workflow.
  // Others see them as a prompt to explore the influencer path.

  {
    target: '[data-tour="nav-influencer-profile"]',
    title: '🌟 Influencer Profile',
    description: 'You can become an influencer right here — no separate account needed! Set your niche, platforms, base rate, and portfolio. Brands will discover and invite you to paid campaigns.',
    role: 'consumer',
    position: 'right',
    icon: '🌟',
  },
  {
    target: '[data-tour="nav-influencer-campaigns"]',
    title: '📣 My Campaigns',
    description: 'Receive campaign invitations from brands. Review the brief, accept or reject, submit deliverables milestone by milestone — everything managed in one place.',
    role: 'consumer',
    position: 'right',
    icon: '📣',
  },
  {
    target: '[data-tour="nav-influencer-content"]',
    title: '🎬 My Content',
    description: 'Manage all your content posts across platforms. Link posts to campaigns, track cross-posting, and build a portfolio that makes brands want to work with you again.',
    role: 'consumer',
    position: 'right',
    icon: '🎬',
  },

  // ═══════════════════════════════════════════════════════════════
  // SHARED — shown to both roles after role-specific steps
  // ═══════════════════════════════════════════════════════════════

  {
    target: '[data-tour="nav-social"]',
    title: '🌐 Social Hub',
    description: 'Connect your social accounts to supercharge your personalization. Link LinkedIn or YouTube — Instagram is rolling out soon — and we\'ll learn your real interests, making every recommendation, deal and insight more relevant to you.',
    position: 'right',
    icon: '🌐',
  },
  {
    target: '[data-tour="nav-community"]',
    title: '👥 Community',
    description: 'Discover and share real deals, offers and product insights with thousands of users. Post deals you find, upvote the best ones, get brand-verified offers — and earn points for every contribution.',
    position: 'right',
    icon: '👥',
  },
  {
    target: '[data-tour="notifications"]',
    title: '🔔 Notifications',
    description: 'Stay on top of everything — new feedback, ranking changes, campaign updates, reward milestones, and more.',
    position: 'bottom',
    icon: '🔔',
  },
  {
    target: '[data-tour="user-menu"]',
    title: '👤 Your Profile',
    description: 'Access account settings, privacy preferences, and sign-out from here. You can also restart this tour from your profile menu anytime.',
    position: 'bottom',
    icon: '👤',
  },
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Settings',
    description: 'Update your profile, manage notification preferences, and control your account — all in one place.',
    position: 'right',
    icon: '⚙️',
  },

  // ── Finale ──
  {
    target: '[data-tour="welcome"]',
    title: '🎉 You\'re All Set!',
    description: 'You know your way around Earn4Insights! Start exploring — and you can restart this tour anytime from your profile menu.',
    position: 'bottom',
    icon: '🎉',
  },
]

// ─── Tour Storage ────────────────────────────────────────────────

/**
 * Storage key is role-scoped so that:
 * - A consumer who later registers as influencer gets a fresh tour (new steps).
 * - A brand switching back doesn't inherit the consumer tour state.
 */
function getTourStorageKey(userId?: string, role?: string): string {
  const roleSlug = role ?? 'guest'
  return userId ? `e4i_product_tour_${userId}_${roleSlug}` : `e4i_product_tour_${roleSlug}`
}

function getTourState(userId?: string, role?: string): { completed: boolean; dismissed: boolean } {
  if (typeof window === 'undefined') return { completed: false, dismissed: false }
  try {
    const raw = localStorage.getItem(getTourStorageKey(userId, role))
    if (raw) return JSON.parse(raw)
  } catch { }
  return { completed: false, dismissed: false }
}

function setTourState(state: { completed: boolean; dismissed: boolean }, userId?: string, role?: string) {
  try {
    localStorage.setItem(getTourStorageKey(userId, role), JSON.stringify(state))
  } catch { }
}

// ─── Spotlight Overlay ───────────────────────────────────────────

function SpotlightOverlay({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null

  const padding = 8
  const borderRadius = 12

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none">
      <svg className="w-full h-full">
        <defs>
          <mask id="tour-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx={borderRadius}
              ry={borderRadius}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-spotlight)"
        />
        {/* Glowing border around spotlight */}
        <rect
          x={rect.left - padding}
          y={rect.top - padding}
          width={rect.width + padding * 2}
          height={rect.height + padding * 2}
          rx={borderRadius}
          ry={borderRadius}
          fill="none"
          stroke="rgba(168, 85, 247, 0.7)"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep
  stepIndex: number
  totalSteps: number
  targetRect: DOMRect | null
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalSteps - 1

  useEffect(() => {
    if (!targetRect || !tooltipRef.current) return

    const tooltip = tooltipRef.current
    const tooltipRect = tooltip.getBoundingClientRect()
    const position = step.position || 'bottom'
    const gap = 16

    let top = 0
    let left = 0

    switch (position) {
      case 'bottom':
        top = targetRect.bottom + gap
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
        break
      case 'top':
        top = targetRect.top - tooltipRect.height - gap
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
        break
      case 'right':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
        left = targetRect.right + gap
        break
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
        left = targetRect.left - tooltipRect.width - gap
        break
    }

    // Keep tooltip within viewport
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (left < 12) left = 12
    if (left + tooltipRect.width > vw - 12) left = vw - tooltipRect.width - 12
    if (top < 12) top = 12
    if (top + tooltipRect.height > vh - 12) top = vh - tooltipRect.height - 12

    setPos({ top, left })
  }, [targetRect, step.position])

  const progress = ((stepIndex + 1) / totalSteps) * 100

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-[340px] max-w-[calc(100vw-24px)] bg-card border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-900/20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold leading-tight">{step.title}</h3>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Close tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {step.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {totalSteps}
          </span>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button size="sm" variant="ghost" onClick={onPrev} className="h-8 px-3 text-xs">
                <ChevronLeft className="w-3 h-3 mr-1" />
                Back
              </Button>
            )}
            {isFirst && (
              <Button size="sm" variant="ghost" onClick={onSkip} className="h-8 px-3 text-xs text-muted-foreground">
                Skip tour
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="h-8 px-4 text-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isLast ? (
                <>
                  Finish <PartyPopper className="w-3 h-3 ml-1" />
                </>
              ) : (
                <>
                  Next <ChevronRight className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Tour Component ─────────────────────────────────────────

export function ProductTour() {
const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [filteredSteps, setFilteredSteps] = useState<TourStep[]>([])  
  const [mounted, setMounted] = useState(false)

  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined
  const userId = (session?.user as any)?.id as string | undefined

  // Filter steps by role
  useEffect(() => {
    const role = userRole || 'consumer'
    const steps = TOUR_STEPS.filter(s => !s.role || s.role === role)
    setFilteredSteps(steps)
  }, [userRole])

  // Mount check
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-start tour for first-time users (after small delay for DOM to settle)
  // Storage key is role-scoped — consumers who become influencers get a fresh tour.
  useEffect(() => {
    if (!mounted || status === 'loading') return
    const state = getTourState(userId, userRole)
    if (!state.completed && !state.dismissed && pathname.startsWith('/dashboard')) {
      const timer = setTimeout(() => {
        setIsActive(true)
        setCurrentStep(0)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [mounted, pathname, status, userId, userRole])

  // Expose global function to restart tour
  useEffect(() => {
    (window as any).__startProductTour = () => {
      setTourState({ completed: false, dismissed: false }, userId, userRole)
      setCurrentStep(0)
      setIsActive(true)
    }
    return () => { delete (window as any).__startProductTour }
  }, [userId, userRole])

  // Position the spotlight on the target element
  const updateTargetRect = useCallback(() => {
    if (!isActive || filteredSteps.length === 0) return

    const step = filteredSteps[currentStep]
    if (!step) return

    const el = document.querySelector(step.target)
    if (el) {
      const rect = el.getBoundingClientRect()
      setTargetRect(rect)
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    } else {
      // If element not found, use centered fallback
      setTargetRect(new DOMRect(window.innerWidth / 2 - 100, 80, 200, 40))
    }
  }, [isActive, currentStep, filteredSteps])

  useEffect(() => {
    updateTargetRect()
    // Also re-measure on scroll/resize
    window.addEventListener('scroll', updateTargetRect, true)
    window.addEventListener('resize', updateTargetRect)
    return () => {
      window.removeEventListener('scroll', updateTargetRect, true)
      window.removeEventListener('resize', updateTargetRect)
    }
  }, [updateTargetRect])

  const handleNext = useCallback(() => {
    if (currentStep >= filteredSteps.length - 1) {
      setIsActive(false)
      setTourState({ completed: true, dismissed: false }, userId, userRole)
      return
    }
    setCurrentStep(prev => prev + 1)
  }, [currentStep, filteredSteps.length, userId, userRole])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleSkip = useCallback(() => {
    setIsActive(false)
    setTourState({ completed: false, dismissed: true }, userId, userRole)
  }, [userId, userRole])

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, handleNext, handlePrev, handleSkip])

  if (!mounted || !isActive || filteredSteps.length === 0) return null

  const step = filteredSteps[currentStep]

  return createPortal(
    <>
      <SpotlightOverlay rect={targetRect} />
      {/* Clickable backdrop to prevent interaction behind tour */}
      <div className="fixed inset-0 z-[9998]" onClick={(e) => e.stopPropagation()} />
      <TourTooltip
        step={step}
        stepIndex={currentStep}
        totalSteps={filteredSteps.length}
        targetRect={targetRect}
        onNext={handleNext}
        onPrev={handlePrev}
        onSkip={handleSkip}
      />
    </>,
    document.body
  )
}

// ─── Restart Tour Button (for use in menus/settings) ─────────────

export function RestartTourButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => {
        if (typeof window !== 'undefined' && (window as any).__startProductTour) {
          (window as any).__startProductTour()
        }
      }}
      className={className}
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Restart Product Tour
    </button>
  )
}
