/**
 * Simple in-memory rate limiter suitable for Vercel serverless.
 *
 * NOTE: On Vercel, each serverless function instance has its own memory,
 * so this provides per-instance limiting (not global). This is still
 * effective at reducing abuse from individual IPs hitting the same instance.
 *
 * For stricter global rate limiting, consider Vercel KV or Upstash Redis.
 */

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodic cleanup to prevent memory leaks (every 60s)
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 60_000

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

export type RateLimitConfig = {
  /** Max requests allowed in the window */
  maxRequests: number
  /** Time window in seconds */
  windowSeconds: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check and consume a rate limit token for the given key.
 * Returns whether the request is allowed.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup()

  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 })
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowSeconds * 1000 }
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * Extract a rate limit key from a request (IP-based).
 */
export function getRateLimitKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `${prefix}:${ip}`
}

/** Pre-configured limits for common endpoints */
export const RATE_LIMITS = {
  feedbackSubmit: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,
  surveyResponse: { maxRequests: 20, windowSeconds: 60 } as RateLimitConfig,
  analyticsEvent: { maxRequests: 100, windowSeconds: 60 } as RateLimitConfig,
  authAttempt: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  communityPost: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,
  signup: { maxRequests: 3, windowSeconds: 60 } as RateLimitConfig,
} as const
