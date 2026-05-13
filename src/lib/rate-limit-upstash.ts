import 'server-only'
import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limit'

/**
 * Distributed rate limiter via Upstash Redis with in-memory fallback.
 *
 * Architecture:
 *  - When UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, all
 *    limiters use Upstash sliding-window rate limiting (global, durable
 *    across Vercel serverless instances).
 *  - When env vars are unset (local dev / misconfigured prod), falls back
 *    to in-memory limiter from src/lib/rate-limit.ts. Per-instance only,
 *    not durable, but keeps local development working.
 *  - All Upstash failures fail-open with [RATE_LIMIT_FAIL_OPEN] log prefix
 *    so a Redis outage doesn't lock everyone out of the platform.
 *
 * Keying:
 *  - Each limiter has a name → keys are namespaced as
 *    `e4i:<env>:<limiter-name>:<caller-key>` where env is prod|preview|dev.
 *    One Redis DB can serve all environments without cross-contamination.
 */

// ── Environment prefix ────────────────────────────────────────────
function getEnvPrefix(): string {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV
  if (env === 'production') return 'prod'
  if (env === 'preview') return 'preview'
  return 'dev'
}
const ENV_PREFIX = getEnvPrefix()

// ── Upstash client (lazy) ─────────────────────────────────────────
let redis: Redis | null = null
let redisInitTried = false
function getRedis(): Redis | null {
  if (redisInitTried) return redis
  redisInitTried = true
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    console.warn(
      '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — falling back to in-memory rate limiting'
    )
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

// ── Limiter interface ─────────────────────────────────────────────
export type LimitResult = {
  success: boolean
  remaining: number
  /** Epoch ms when the window resets. */
  reset: number
}
export type Limiter = { limit: (key: string) => Promise<LimitResult> }

type LimiterSpec = {
  /** Used in Redis key prefix and log lines. Kebab-case. */
  name: string
  /** Max requests in window. */
  tokens: number
  /**
   * Window string: "<n> <unit>" where unit is s|m|h|d.
   * Example: "15 m", "1 h", "30 d", "30 s".
   */
  window: string
}

function parseWindowSeconds(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/)
  if (!match) throw new Error(`Invalid window format: ${window}`)
  const n = Number(match[1])
  switch (match[2]) {
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
  }
  throw new Error(`Invalid unit: ${match[2]}`)
}

function createLimiter(spec: LimiterSpec): Limiter {
  const fullPrefix = `e4i:${ENV_PREFIX}:${spec.name}`
  const upstash = getRedis()

  if (upstash) {
    const rl = new Ratelimit({
      redis: upstash,
      limiter: Ratelimit.slidingWindow(
        spec.tokens,
        spec.window as Parameters<typeof Ratelimit.slidingWindow>[1]
      ),
      prefix: fullPrefix,
      analytics: false,
    })
    return {
      async limit(key: string) {
        try {
          const r = await rl.limit(key)
          return { success: r.success, remaining: r.remaining, reset: r.reset }
        } catch (err) {
          console.error(
            `[RATE_LIMIT_FAIL_OPEN] ${spec.name} Upstash error for key="${key}":`,
            err
          )
          return { success: true, remaining: -1, reset: 0 }
        }
      },
    }
  }

  // In-memory fallback for local dev (or prod without Upstash configured).
  const config: RateLimitConfig = {
    maxRequests: spec.tokens,
    windowSeconds: parseWindowSeconds(spec.window),
  }
  return {
    async limit(key: string) {
      const r = checkRateLimit(`${fullPrefix}:${key}`, config)
      return { success: r.allowed, remaining: r.remaining, reset: r.resetAt }
    },
  }
}

// ── Pre-configured limiters ───────────────────────────────────────
// Login attempts — keyed by email (IP rotation is easy; email is the target).
export const loginRateLimit = createLimiter({ name: 'login', tokens: 5, window: '15 m' })

// Signup — IP-keyed (no email yet at the rate-limit point).
export const signupRateLimit = createLimiter({ name: 'signup', tokens: 3, window: '1 h' })

// Forgot password — keyed by email. Prevents email-bomb attacks even
// when an attacker rotates IPs.
export const forgotPasswordRateLimit = createLimiter({
  name: 'forgot-password',
  tokens: 1,
  window: '15 m',
})

// Reset password — keyed by token prefix.
export const resetPasswordRateLimit = createLimiter({
  name: 'reset-password',
  tokens: 5,
  window: '15 m',
})

// Payments — keyed by user ID (brand session).
export const paymentCreateOrderRateLimit = createLimiter({
  name: 'payment-create-order',
  tokens: 10,
  window: '1 m',
})
export const paymentVerifyRateLimit = createLimiter({
  name: 'payment-verify',
  tokens: 20,
  window: '1 m',
})

// Feedback / uploads — keyed by user ID.
export const feedbackSubmitRateLimit = createLimiter({
  name: 'feedback-submit',
  tokens: 10,
  window: '1 m',
})
export const uploadRateLimit = createLimiter({ name: 'upload', tokens: 30, window: '5 m' })

// Community posts — keyed by user ID.
export const communityPostRateLimit = createLimiter({
  name: 'community-post',
  tokens: 5,
  window: '1 m',
})

// ICP bulk score — keyed by brand ID.
export const bulkScoreRateLimit = createLimiter({ name: 'bulk-score', tokens: 2, window: '1 m' })

// Competitive intelligence — keyed by brand ID.
export const competitiveAiGenerateRateLimit = createLimiter({
  name: 'competitive-ai',
  tokens: 3,
  window: '1 m',
})
export const competitiveRecomputeRateLimit = createLimiter({
  name: 'competitive-recompute',
  tokens: 5,
  window: '1 m',
})
export const competitiveReadRateLimit = createLimiter({
  name: 'competitive-read',
  tokens: 30,
  window: '1 m',
})

// Tracking — IP-keyed.
export const trackEventRateLimit = createLimiter({
  name: 'track-event',
  tokens: 100,
  window: '1 m',
})
export const emailClickRateLimit = createLimiter({
  name: 'email-click',
  tokens: 30,
  window: '1 m',
})

// Search — IP-keyed.
export const searchRateLimit = createLimiter({ name: 'search', tokens: 60, window: '1 m' })

// DSAR — keyed by user ID. Belt-and-suspenders alongside the
// DB-level 30-day rule enforced in dsarService. HTTP-layer block
// prevents hammering the endpoint and exhausting OTP send quota
// before the DB check runs.
export const dsarRateLimit = createLimiter({ name: 'dsar', tokens: 1, window: '30 d' })

// ── Helpers ───────────────────────────────────────────────────────
/**
 * Extract the client IP from a request. Use as part of the limit key
 * for IP-based limiters (signup, search, track-event, email-click).
 */
export function ipFromRequest(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}
