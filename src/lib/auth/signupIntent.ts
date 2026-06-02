import 'server-only'

/**
 * `e4i-signup-intent` cookie — carries the role a brand-new user selected on
 * the /signup page through the Google OAuth round-trip. HMAC-SHA-256 signed
 * with AUTH_SECRET so the role cannot be forged client-side.
 *
 * Flow:
 *   1. /signup user picks role + clicks "Sign up with Google"
 *   2. Client POSTs /api/auth/signup-intent which mints this cookie
 *   3. Client calls signIn('google') — Google round-trip
 *   4. auth.config signIn callback reads + verifies the cookie
 *      - valid signature, not expired, user does NOT exist → createUser with intent.role
 *      - valid signature, not expired, user exists         → ignore (DB role wins)
 *      - no cookie / invalid / expired, user does NOT exist → reject with redirect to /login?error=no_account
 *      - no cookie / invalid / expired, user exists         → normal login
 *
 * The /login page never sets this cookie, so logging in with Google by a
 * brand-new user is always rejected — preventing accidental account creation
 * at an inferred role (matches the Stripe/Auth0 pattern).
 *
 * Web Crypto only (no node:crypto) — same constraint as twoFactor/proofCookie.ts.
 * Imported by both the route handler and the auth.config signIn callback.
 */

import type { SignupRole } from '@/lib/user/types'

export const SIGNUP_INTENT_COOKIE = 'e4i-signup-intent'

/**
 * 5-minute TTL covers a brand-new user clicking "Sign up with Google",
 * picking their Google account, and consenting on Google's screen.
 * Short enough that an abandoned signup can't bleed into a later
 * unrelated login attempt that creates an account at the wrong role.
 */
export const SIGNUP_INTENT_TTL_MS = 5 * 60 * 1000 // 5 min

/**
 * Roles that can be self-selected at signup. Admin is never self-assignable.
 * Influencer was added in Phase 3.5A — first-class signup option.
 */
const ALLOWED_SIGNUP_ROLES: ReadonlySet<SignupRole> = new Set<SignupRole>([
  'brand',
  'consumer',
  'influencer',
])

export function isAllowedSignupRole(value: unknown): value is SignupRole {
  return typeof value === 'string' && ALLOWED_SIGNUP_ROLES.has(value as SignupRole)
}

function getSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is required to sign the signup-intent cookie')
  return s
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Inferred return — see proofCookie.ts for the TS 5.7+ ArrayBufferLike note.
function b64urlToBytes(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * Sign and serialise an intent cookie for the given role. The payload
 * carries the role, an expiry timestamp, and a random nonce so two
 * cookies minted in the same second don't share bytes.
 */
export async function signSignupIntent(
  role: SignupRole,
  ttlMs: number = SIGNUP_INTENT_TTL_MS,
): Promise<string> {
  if (!isAllowedSignupRole(role)) {
    throw new Error(`Invalid signup role: ${role}`)
  }
  // 12 random bytes via Web Crypto — no Node dependency.
  const nonceBytes = new Uint8Array(12)
  crypto.getRandomValues(nonceBytes)
  const payloadObj = {
    r: role,
    e: Date.now() + ttlMs,
    n: bytesToB64url(nonceBytes),
  }
  const payload = bytesToB64url(new TextEncoder().encode(JSON.stringify(payloadObj)))
  const sig = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(payload))
  return `${payload}.${bytesToB64url(new Uint8Array(sig))}`
}

export interface VerifiedSignupIntent {
  role: SignupRole
  /** Unix ms when the cookie expires. */
  expiresAt: number
}

/**
 * Verify a raw cookie value. Returns the verified intent payload on success,
 * or null on any failure (missing, malformed, bad signature, expired,
 * unknown role). Never throws — caller treats null as "no valid intent".
 */
export async function verifySignupIntent(
  cookieValue: string | null | undefined,
): Promise<VerifiedSignupIntent | null> {
  if (!cookieValue) return null
  const dot = cookieValue.indexOf('.')
  if (dot <= 0) return null
  const payload = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      b64urlToBytes(sig),
      new TextEncoder().encode(payload),
    )
    if (!valid) return null

    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as {
      r?: unknown
      e?: unknown
      n?: unknown
    }
    if (typeof data.e !== 'number' || Date.now() > data.e) return null
    if (!isAllowedSignupRole(data.r)) return null
    return { role: data.r, expiresAt: data.e }
  } catch {
    return null
  }
}
