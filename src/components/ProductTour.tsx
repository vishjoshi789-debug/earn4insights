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
  /** Which role sees this step (omit for all) */
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

const TOUR_STEPS: TourStep[] = [
  // ── Welcome (all users) ──
  {
    target: '[data-tour="welcome"]',
    title: '👋 Welcome to Earn4Insights!',
    description: 'This quick tour will show you everything you can do here. It takes under 2 minutes!',
    position: 'bottom',
    icon: '🎉',
  },

  // ── Sidebar nav (all users) ──
  {
    target: '[data-tour="nav-dashboard"]',
    title: '🏠 Your Dashboard',
    description: 'This is your home base. See personalized recommendations, feedback stats, and quick actions at a glance.',
    position: 'right',
  },

  // ── Brand-specific tour ──
  {
    target: '[data-tour="nav-products"]',
    title: '📦 Your Products',
    description: 'View and manage all your products. Track performance, see ratings, and monitor how consumers engage with each one.',
    role: 'brand',
    position: 'right',
    icon: '📦',
  },
  {
    target: '[data-tour="nav-launch"]',
    title: '🚀 Launch a New Product',
    description: 'Add new products to the platform. Once launched, consumers can discover, review, and rate them — giving you real feedback.',
    role: 'brand',
    position: 'right',
    icon: '🚀',
  },
  {
    target: '[data-tour="nav-surveys"]',
    title: '📊 Surveys & NPS',
    description: 'Create surveys to gather direct consumer opinions. Track your Net Promoter Score (NPS) to measure customer loyalty.',
    role: 'brand',
    position: 'right',
    icon: '📊',
  },
  {
    target: '[data-tour="nav-feedback"]',
    title: '💬 Consumer Feedback',
    description: 'Read honest feedback from real consumers. See what they love, what needs improvement, and respond to build trust.',
    role: 'brand',
    position: 'right',
    icon: '💬',
  },
  {
    target: '[data-tour="nav-analytics"]',
    title: '📈 Unified Analytics',
    description: 'Your command center! See demographics, engagement trends, sentiment analysis, and conversion metrics — all in one view.',
    role: 'brand',
    position: 'right',
    icon: '📈',
  },
  {
    target: '[data-tour="nav-detailed-analytics"]',
    title: '🔍 Detailed Product Analytics',
    description: 'Deep-dive into individual product performance. Compare metrics, track trends over time, and identify your top performers.',
    role: 'brand',
    position: 'right',
    icon: '🔍',
  },
  {
    target: '[data-tour="nav-rankings"]',
    title: '🏆 Weekly Top 10',
    description: 'See how your products rank against competitors each week. Higher rankings mean more visibility to consumers!',
    role: 'brand',
    position: 'right',
    icon: '🏆',
  },

  // ── Consumer-specific tour ──
  {
    target: '[data-tour="nav-products"]',
    title: '🛍️ Discover Products',
    description: 'Browse products from brands looking for your honest opinion. Click "Give Feedback" on any product to earn rewards!',
    role: 'consumer',
    position: 'right',
    icon: '🛍️',
  },
  {
    target: '[data-tour="nav-submit-feedback"]',
    title: '✍️ Submit Feedback',
    description: 'Your voice matters! Write reviews, record voice or video feedback, upload photos — in any language. Earn 25 points per submission.',
    role: 'consumer',
    position: 'right',
    icon: '✍️',
  },
  {
    target: '[data-tour="nav-my-feedback"]',
    title: '📋 My Feedback History',
    description: 'Track everything you\'ve submitted — see ratings, sentiment analysis, and whether brands have reviewed your feedback.',
    role: 'consumer',
    position: 'right',
    icon: '📋',
  },
  {
    target: '[data-tour="nav-rankings"]',
    title: '🏆 Weekly Top 10',
    description: 'See this week\'s highest-rated products, voted by consumers like you. You can give feedback directly from any ranked product!',
    role: 'consumer',
    position: 'right',
    icon: '🏆',
  },
  {
    target: '[data-tour="nav-surveys"]',
    title: '📋 Take Surveys',
    description: 'Complete brand surveys to share your opinions. Each survey you complete earns you points and rewards.',
    role: 'consumer',
    position: 'right',
    icon: '📋',
  },
  {
    target: '[data-tour="nav-rewards"]',
    title: '🎁 Your Rewards',
    description: 'Track your earnings from surveys, reviews, and feedback. Redeem points for real rewards and payouts!',
    role: 'consumer',
    position: 'right',
    icon: '🎁',
  },
  {
    target: '[data-tour="nav-payouts"]',
    title: '💰 Payouts',
    description: 'Cash out your earned rewards. We support multiple payout methods so you get paid for your insights.',
    role: 'consumer',
    position: 'right',
    icon: '💰',
  },

  // ── Common steps (all users) ──
  {
    target: '[data-tour="nav-social"]',
    title: '🌐 Social Hub',
    description: 'Connect with the community. Share your thoughts, follow trends, and see what others are saying about products.',
    position: 'right',
    icon: '🌐',
  },
  {
    target: '[data-tour="nav-community"]',
    title: '👥 Community',
    description: 'Join discussions, ask questions, and connect with other users. Your voice matters in shaping products!',
    position: 'right',
    icon: '👥',
  },
  {
    target: '[data-tour="nav-rewards"]',
    title: '🎁 Rewards',
    description: 'View your earned rewards from engagement, surveys, and feedback. Active participation means more rewards!',
    role: 'brand',
    position: 'right',
    icon: '🎁',
  },

  // ── Header area ──
  {
    target: '[data-tour="notifications"]',
    title: '🔔 Notifications',
    description: 'Stay updated! You\'ll get notified about new survey responses, feedback, ranking changes, and reward milestones.',
    position: 'bottom',
    icon: '🔔',
  },
  {
    target: '[data-tour="user-menu"]',
    title: '👤 Your Profile',
    description: 'Access your account settings, privacy preferences, and sign-out option from here.',
    position: 'bottom',
    icon: '👤',
  },

  // ── Settings ──
  {
    target: '[data-tour="nav-settings"]',
    title: '⚙️ Settings & Privacy',
    description: 'Control your data, manage consent, update your profile, and customize your experience. Your privacy is always in your hands.',
    position: 'right',
    icon: '⚙️',
  },

  // ── Finale ──
  {
    target: '[data-tour="welcome"]',
    title: '🎉 You\'re All Set!',
    description: 'You now know your way around Earn4Insights! Start exploring — and remember, you can restart this tour anytime from your profile menu.',
    position: 'bottom',
    icon: '🎉',
  },
]

// ─── Tour Storage ────────────────────────────────────────────────

const TOUR_STORAGE_KEY = 'e4i_product_tour'

function getTourState(): { completed: boolean; dismissed: boolean } {
  if (typeof window === 'undefined') return { completed: false, dismissed: false }
  try {
    const raw = localStorage.getItem(TOUR_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { }
  return { completed: false, dismissed: false }
}

function setTourState(state: { completed: boolean; dismissed: boolean }) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(state))
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
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [filteredSteps, setFilteredSteps] = useState<TourStep[]>([])
  const [mounted, setMounted] = useState(false)

  const userRole = (session?.user as any)?.role as 'brand' | 'consumer' | undefined

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
  useEffect(() => {
    if (!mounted) return
    const state = getTourState()
    if (!state.completed && !state.dismissed && pathname === '/dashboard') {
      const timer = setTimeout(() => {
        setIsActive(true)
        setCurrentStep(0)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [mounted, pathname])

  // Expose global function to restart tour
  useEffect(() => {
    (window as any).__startProductTour = () => {
      setTourState({ completed: false, dismissed: false })
      setCurrentStep(0)
      setIsActive(true)
    }
    return () => { delete (window as any).__startProductTour }
  }, [])

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
      // Tour complete
      setIsActive(false)
      setTourState({ completed: true, dismissed: false })
      return
    }
    setCurrentStep(prev => prev + 1)
  }, [currentStep, filteredSteps.length])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const handleSkip = useCallback(() => {
    setIsActive(false)
    setTourState({ completed: false, dismissed: true })
  }, [])

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
