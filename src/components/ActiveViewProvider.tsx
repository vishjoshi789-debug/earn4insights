'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

/**
 * Active view = which role's surface the user is currently looking at.
 * For single-role users this always equals their primary role
 * (users.role). For dual-role users (e.g. consumer + influencer) it can
 * be toggled via the RoleSwitcher in the dashboard header.
 *
 * Two-tier persistence (3.5E Q1):
 *   - session toggle (sessionStorage) — cheap, no DB write, resets at
 *     each login
 *   - "Make default" — updates users.role via POST /api/user/primary-view
 *     (kept outside this provider; the provider just consumes whatever
 *     defaultView the layout passes in based on session.user.role)
 *
 * Hydration-safe: SSR renders with defaultView; the provider switches
 * to the sessionStorage value (if any) AFTER mount to avoid hydration
 * mismatches.
 */

type ActiveView = 'brand' | 'consumer' | 'influencer' | 'admin'

const STORAGE_KEY = 'e4i_active_view'

interface ActiveViewContextValue {
  /** The view currently being rendered. Drives the sidebar filter. */
  activeView: ActiveView
  /** Switch the active view (session-only). RoleSwitcher exposes this. */
  setActiveView: (view: ActiveView) => void
  /** The user's stored primary role (users.role). For "is this default?" */
  defaultView: ActiveView
}

const ActiveViewContext = createContext<ActiveViewContextValue | null>(null)

function isValidView(value: unknown): value is ActiveView {
  return value === 'brand' || value === 'consumer' || value === 'influencer' || value === 'admin'
}

export function ActiveViewProvider({
  children,
  defaultView,
}: {
  children: ReactNode
  defaultView: ActiveView
}) {
  // Server-side render with the default; client takes over after mount.
  const [activeView, setActiveViewState] = useState<ActiveView>(defaultView)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (isValidView(stored)) {
        setActiveViewState(stored)
      }
    } catch {
      /* quota / disabled — fall through to defaultView */
    }
  }, [])

  // When the default view changes (e.g. user hits "Make default" and a
  // session refresh kicks in), and the active view matches the OLD default,
  // sync. Avoids stale activeView pointing at the now-deleted view.
  useEffect(() => {
    if (!mounted) return
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (!isValidView(stored)) {
        // No explicit toggle — track the default.
        setActiveViewState(defaultView)
      }
    } catch { /* ignore */ }
  }, [defaultView, mounted])

  const setActiveView = (view: ActiveView) => {
    setActiveViewState(view)
    try {
      sessionStorage.setItem(STORAGE_KEY, view)
    } catch {
      /* ignore */
    }
  }

  return (
    <ActiveViewContext.Provider
      value={{
        // Until mount, render with defaultView so SSR + client-initial
        // paint match. After mount, switch to sessionStorage value.
        activeView: mounted ? activeView : defaultView,
        setActiveView,
        defaultView,
      }}
    >
      {children}
    </ActiveViewContext.Provider>
  )
}

export function useActiveView(): ActiveViewContextValue {
  const ctx = useContext(ActiveViewContext)
  if (!ctx) {
    // Defensive fallback — if a consumer mounts outside the provider
    // (e.g. on a marketing page) return a sane default rather than
    // throwing. Returns a no-op setter so calls don't crash.
    return {
      activeView: 'consumer',
      setActiveView: () => {},
      defaultView: 'consumer',
    }
  }
  return ctx
}
