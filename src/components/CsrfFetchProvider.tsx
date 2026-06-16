'use client'

import { useEffect } from 'react'
import { ensureCsrfCookie } from '@/lib/api-client'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Mirror of middleware's CSRF_EXEMPT_PREFIXES — these routes are not a
// cookie-CSRF surface, so don't bother attaching a token.
const CSRF_EXEMPT_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/cron/',
  '/api/jobs/',
  '/api/pusher/',
  '/api/csrf/',
]

const CSRF_COOKIE_NAME = 'e4i-csrf'
const CSRF_HEADER_NAME = 'x-csrf-token'

function readCsrfCookie(): string {
  const m = document.cookie.match(/(?:^|;\s*)e4i-csrf=([^;]+)/)
  if (!m) return ''
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

declare global {
  interface Window {
    __e4iCsrfFetchPatched?: boolean
  }
}

/**
 * Global fetch interceptor: attaches the CSRF double-submit header
 * (`x-csrf-token` = the `e4i-csrf` cookie) to **same-origin mutating /api**
 * requests, so the ~100 raw `fetch()` callsites pass the middleware-enforced
 * CSRF check without each one being rewritten to use the api-client helpers.
 *
 * Attaches ONLY when every condition holds — anything else is passed through
 * untouched:
 *   - method is POST / PUT / PATCH / DELETE   (reads never need a token)
 *   - URL is same-origin                      (external APIs untouched)
 *   - path is /api/ and not an exempt prefix
 *   - caller hasn't already set x-csrf-token  (apiPost/apiPatch still win)
 *
 * The cookie is minted first via the shared, memoised `ensureCsrfCookie()`
 * (a GET to the exempt `/api/csrf/` route — not re-intercepted). Any error in
 * the interceptor falls through to the original fetch, so it can never break
 * a request. Mounted once near the app root; the window guard prevents
 * double-patching across layouts.
 */
export function CsrfFetchProvider() {
  useEffect(() => {
    if (typeof window === 'undefined' || window.__e4iCsrfFetchPatched) return
    window.__e4iCsrfFetchPatched = true
    const orig = window.fetch.bind(window)

    const patched = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      try {
        const method = (
          init?.method ?? (input instanceof Request ? input.method : 'GET')
        ).toUpperCase()
        if (MUTATING_METHODS.has(method)) {
          const rawUrl = input instanceof Request ? input.url : String(input)
          const url = new URL(rawUrl, window.location.origin)
          const sameOrigin = url.origin === window.location.origin
          const isApi = url.pathname.startsWith('/api/')
          const exempt = CSRF_EXEMPT_PREFIXES.some((p) => url.pathname.startsWith(p))
          if (sameOrigin && isApi && !exempt) {
            const headers = new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            )
            // Don't clobber a token a caller (apiPost) already set.
            if (!headers.has(CSRF_HEADER_NAME)) {
              await ensureCsrfCookie()
              const token = readCsrfCookie()
              if (token) {
                headers.set(CSRF_HEADER_NAME, token)
                if (input instanceof Request) {
                  return orig(new Request(input, { headers }))
                }
                return orig(input, { ...init, headers })
              }
            }
          }
        }
      } catch {
        // Never let the interceptor break a request.
      }
      return orig(input, init)
    }

    window.fetch = patched as typeof window.fetch

    return () => {
      window.fetch = orig
      window.__e4iCsrfFetchPatched = false
    }
  }, [])

  return null
}
