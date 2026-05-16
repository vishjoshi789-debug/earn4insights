const CSRF_META_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'
const CSRF_COOKIE_NAME = 'e4i-csrf'

/**
 * Read the current CSRF token.
 *
 * Source order:
 *   1. `e4i-csrf` cookie (always current — refreshed by middleware on
 *      every request, non-httpOnly by design so JS can read it)
 *   2. `<meta name="csrf-token">` (fallback for early SSR-rendered pages
 *      where the cookie may not yet be set client-side)
 *
 * Prior versions read only the meta tag, which can be empty or stale —
 * e.g. when the meta was rendered on a cached page response that did
 * not go through middleware, or after the cookie was refreshed by a
 * later request. Reading the cookie directly fixes "Invalid or missing
 * CSRF token" 403s on long-running pages and on the floating chat
 * widget where the first POST can happen well after the initial render.
 */
function getCsrfToken(): string {
  if (typeof document === 'undefined') return ''
  // 1. Cookie first — always current.
  if (typeof document.cookie === 'string' && document.cookie) {
    const pattern = new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`)
    const m = document.cookie.match(pattern)
    if (m && m[1]) {
      try {
        return decodeURIComponent(m[1])
      } catch {
        return m[1]
      }
    }
  }
  // 2. Meta tag fallback.
  const meta = document.querySelector(`meta[name="${CSRF_META_NAME}"]`)
  return meta?.getAttribute('content') ?? ''
}

type ExtraInit = Omit<RequestInit, 'method' | 'body'>

async function send(
  url: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  body?: unknown,
  init?: ExtraInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (!headers.has('Content-Type') && body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getCsrfToken()
  if (token) headers.set(CSRF_HEADER_NAME, token)
  return fetch(url, {
    ...init,
    method,
    headers,
    // Ensure cookies (e4i-csrf + session) are always sent.
    credentials: init?.credentials ?? 'same-origin',
    body:
      body === undefined
        ? undefined
        : isFormData || typeof body === 'string'
          ? (body as BodyInit)
          : JSON.stringify(body),
  })
}

export const apiPost = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'POST', body, init)
export const apiPatch = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'PATCH', body, init)
export const apiPut = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'PUT', body, init)
export const apiDelete = (url: string, body?: unknown, init?: ExtraInit) =>
  send(url, 'DELETE', body, init)
