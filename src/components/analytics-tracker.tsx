'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// ── Session + Identity ────────────────────────────────────────────

function getOrCreateId(key: string): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let sid = sessionStorage.getItem('e4i_session_id')
  if (!sid) {
    sid = crypto.randomUUID()
    sessionStorage.setItem('e4i_session_id', sid)
    sessionStorage.setItem('e4i_session_start', new Date().toISOString())
  }
  return sid
}

function getSessionStart(): string {
  return sessionStorage.getItem('e4i_session_start') || new Date().toISOString()
}

function getAnonymousId(): string {
  return getOrCreateId('e4i_anon_id')
}

// ── UTM Params ────────────────────────────────────────────────────

function getUtmParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
  }
}

// ── Event Queue + Flush ───────────────────────────────────────────

let eventQueue: any[] = []
let flushTimeout: ReturnType<typeof setTimeout> | null = null

function queueEvent(event: Record<string, any>) {
  const base = {
    sessionId: getSessionId(),
    anonymousId: getAnonymousId(),
    sessionStart: getSessionStart(),
    pageUrl: window.location.href,
    pageTitle: document.title,
    pagePath: window.location.pathname,
    referrer: document.referrer || null,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    language: navigator.language,
    timestamp: new Date().toISOString(),
    ...getUtmParams(),
  }

  eventQueue.push({ ...base, ...event })

  // Flush every 2 seconds or when queue hits 10
  if (eventQueue.length >= 10) {
    flushEvents()
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushEvents, 2000)
  }
}

function flushEvents() {
  if (flushTimeout) {
    clearTimeout(flushTimeout)
    flushTimeout = null
  }

  if (eventQueue.length === 0) return

  const batch = [...eventQueue]
  eventQueue = []

  // Use sendBeacon for reliability (fires even on page unload)
  const payload = JSON.stringify({ events: batch })
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/track', new Blob([payload], { type: 'application/json' }))
  } else {
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }
}

// ── The Tracker Component ─────────────────────────────────────────

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const pageEnteredAt = useRef(Date.now())
  const maxScrollDepth = useRef(0)
  const hasTrackedPageView = useRef(false)

  // Track page views on route change
  useEffect(() => {
    pageEnteredAt.current = Date.now()
    maxScrollDepth.current = 0
    hasTrackedPageView.current = false

    // Slight delay so title is updated by Next.js
    const timer = setTimeout(() => {
      if (!hasTrackedPageView.current) {
        hasTrackedPageView.current = true

        // Measure page load time
        let pageLoadTime: number | undefined
        try {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
          if (nav) pageLoadTime = Math.round(nav.loadEventEnd - nav.startTime)
        } catch {}

        queueEvent({
          eventType: 'page_view',
          eventName: 'page_view',
          pageLoadTime,
        })
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname])

  // Global listeners (mount once)
  useEffect(() => {
    // ── Click tracking ──────────────────────────────────────
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target) return

      // Walk up to find meaningful element (button, link, input)
      let el: HTMLElement | null = target
      for (let i = 0; i < 5 && el; i++) {
        const tag = el.tagName
        if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || el.getAttribute('role') === 'button') {
          break
        }
        el = el.parentElement
      }
      if (!el) el = target

      const tag = el.tagName
      const text = el.textContent?.trim().slice(0, 200) || ''
      const id = el.id || null
      const cls = el.className && typeof el.className === 'string' ? el.className.slice(0, 500) : null

      // Determine event name
      let eventName = 'click'
      if (tag === 'A') eventName = 'link_click'
      else if (tag === 'BUTTON' || el.getAttribute('role') === 'button') eventName = 'button_click'
      else if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) eventName = 'form_interaction'

      queueEvent({
        eventType: 'click',
        eventName,
        elementTag: tag,
        elementText: text,
        elementId: id,
        elementClass: cls,
        clickX: Math.round(e.clientX),
        clickY: Math.round(e.clientY),
        eventData: {
          href: tag === 'A' ? (el as HTMLAnchorElement).href : undefined,
          type: tag === 'INPUT' ? (el as HTMLInputElement).type : undefined,
          name: (el as HTMLInputElement).name || undefined,
        },
      })
    }

    // ── Scroll tracking ─────────────────────────────────────
    function handleScroll() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight
      const depth = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 100
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = depth
      }
    }

    // ── Visibility change (tab switch / close) ──────────────
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Track time on page + scroll depth when leaving
        const timeOnPage = Math.round((Date.now() - pageEnteredAt.current) / 1000)
        queueEvent({
          eventType: 'page_leave',
          eventName: 'page_leave',
          timeOnPage,
          scrollDepth: maxScrollDepth.current,
        })
        flushEvents()
      }
    }

    // ── Form submissions ────────────────────────────────────
    function handleSubmit(e: Event) {
      const form = e.target as HTMLFormElement
      if (!form || form.tagName !== 'FORM') return
      queueEvent({
        eventType: 'form_submit',
        eventName: 'form_submit',
        eventData: {
          action: form.action,
          method: form.method,
          id: form.id || null,
        },
      })
    }

    // ── Before unload ───────────────────────────────────────
    function handleBeforeUnload() {
      const timeOnPage = Math.round((Date.now() - pageEnteredAt.current) / 1000)
      queueEvent({
        eventType: 'page_leave',
        eventName: 'page_unload',
        timeOnPage,
        scrollDepth: maxScrollDepth.current,
      })
      flushEvents()
    }

    // Attach listeners
    document.addEventListener('click', handleClick, { capture: true, passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('submit', handleSubmit, { capture: true })
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('click', handleClick, { capture: true } as any)
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('submit', handleSubmit, { capture: true } as any)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return null // Invisible component — no UI
}
