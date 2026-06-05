import 'server-only'

import { Resend } from 'resend'
import { randomBytes, createHash } from 'crypto'
import { and, eq, isNull, lt } from 'drizzle-orm'

import { db } from '@/db'
import { users, emailVerificationTokens, auditLog } from '@/db/schema'
import { maskEmail } from '@/lib/logger'
import {
  buildVerificationEmailHTML,
  VERIFICATION_EMAIL_SUBJECT,
} from '@/lib/email/templates/email-verification'

/**
 * Email Verification Service (Phase EV.1)
 *
 * Lifecycle:
 *   - generateVerificationToken(userId) → mints a one-time token,
 *     invalidates any prior unused tokens for the same user, stores
 *     SHA-256 hash, returns the plaintext for caller to embed in URL.
 *   - sendVerificationEmail(user) → builds the URL, renders the
 *     branded template, dispatches via Resend, audit-logs the moment.
 *   - verifyEmailToken(plain) → looks up by hash, validates expiry +
 *     used state, flips users.email_verified_at to NOW(), audit-logs.
 *   - resendVerificationEmail(userId) → caller already rate-limited;
 *     re-issues a fresh token + email; returns a friendly result.
 *   - cleanupExpiredTokens() → cron helper; deletes rows past expiry
 *     + 7 days so the DB doesn't grow forever.
 *
 * Mirrors the password_reset_tokens pattern exactly:
 *   - randomBytes(32).toString('hex') for the plaintext token
 *   - createHash('sha256') for storage (never store plaintext)
 *   - One-time use enforced via used_at column
 *
 * Email enumeration: the caller (route layer) is responsible for
 * returning a neutral response shape; this service throws specific
 * errors so the route can decide how loudly to surface them.
 */

let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24h (industry standard, Q3)
const CLEANUP_GRACE_MS = 7 * 24 * 60 * 60 * 1000 // delete after 7d past expiry

function hashToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex')
}

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'
  )
}

// ── Token generation ─────────────────────────────────────────────

/**
 * Mint a new verification token for the user. Invalidates any prior
 * unused tokens by setting their used_at to NOW() (single active token
 * per user — same pattern as password reset).
 *
 * Returns the plaintext token; only the hash is persisted.
 */
export async function generateVerificationToken(userId: string): Promise<{
  plainToken: string
  expiresAt: Date
}> {
  const plainToken = randomBytes(32).toString('hex')
  const tokenHash = hashToken(plainToken)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

  // Atomic transaction: void prior tokens, insert new one. Without the
  // transaction, two concurrent generateVerificationToken calls could
  // both bypass the prior-void step and leave two active rows.
  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          isNull(emailVerificationTokens.usedAt),
        ),
      )
    await tx.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt,
    })
  })

  return { plainToken, expiresAt }
}

// ── Send email ───────────────────────────────────────────────────

/**
 * Generate a token + send the branded verification email.
 *
 * Audit-logs the send so we can investigate "I never got the email"
 * tickets. PII masked (email is sensitive; logger.maskEmail() handles
 * the redaction).
 *
 * Returns ok=true on send, ok=false with reason on failure. Callers
 * are responsible for translating the result into the route response
 * (typically neutral for enumeration safety).
 */
export async function sendVerificationEmail(params: {
  userId: string
  email: string
  name: string | null
}): Promise<{ ok: boolean; reason?: string }> {
  const { userId, email, name } = params
  const resend = getResend()
  if (!resend) {
    console.warn('[EmailVerification] Resend not configured — skipping send')
    return { ok: false, reason: 'resend_not_configured' }
  }

  const { plainToken } = await generateVerificationToken(userId)
  const verifyUrl = `${getAppBaseUrl()}/verify-email?token=${plainToken}`
  const firstName = (name?.split(' ')[0] ?? '').trim() || 'there'

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Earn4Insights <notifications@earn4insights.com>',
      to: email,
      subject: VERIFICATION_EMAIL_SUBJECT,
      html: buildVerificationEmailHTML({ firstName, verifyUrl }),
    })
    if (error) {
      console.error('[EmailVerification] Resend error:', error)
      return { ok: false, reason: 'resend_error' }
    }
  } catch (err) {
    console.error('[EmailVerification] Send failed:', err)
    return { ok: false, reason: 'send_failed' }
  }

  // Audit — PII-masked. Useful for the "never got my email" debug path.
  await db
    .insert(auditLog)
    .values({
      userId,
      action: 'email_verification_sent',
      dataType: 'user',
      accessedBy: userId,
      metadata: { email: maskEmail(email) },
      reason: 'Verification link emailed to user',
    })
    .catch((err) => {
      console.error('[EmailVerification] Audit log failed:', err)
    })

  return { ok: true }
}

// ── Verify token ─────────────────────────────────────────────────

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_used' }

/**
 * Consume a plaintext token. Returns the userId on success so the
 * caller can sign the user in / redirect to dashboard etc.
 *
 * Enumeration-safe: 'not_found' is reused for "no row matched" which
 * could mean a bogus token OR a token that was deleted by cleanup
 * cron. Callers should NOT differentiate these in the UI.
 *
 * Idempotent on success: trying to consume the same token twice
 * returns 'already_used' on the second attempt; flipping
 * users.email_verified_at again is a no-op write (same NOW()-ish
 * value already there).
 */
export async function verifyEmailToken(plainToken: string): Promise<VerifyResult> {
  if (!plainToken || typeof plainToken !== 'string' || plainToken.length < 16) {
    return { ok: false, reason: 'not_found' }
  }
  const tokenHash = hashToken(plainToken)

  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.tokenHash, tokenHash))
    .limit(1)

  if (!row) {
    return { ok: false, reason: 'not_found' }
  }
  if (row.usedAt) {
    return { ok: false, reason: 'already_used' }
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  // Mark token used + flip email_verified_at in one transaction so a
  // crash between the two doesn't leave a half-verified state.
  const verifiedAt = new Date()
  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: verifiedAt })
      .where(eq(emailVerificationTokens.id, row.id))
    await tx
      .update(users)
      .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
      .where(eq(users.id, row.userId))
  })

  await db
    .insert(auditLog)
    .values({
      userId: row.userId,
      action: 'email_verified',
      dataType: 'user',
      accessedBy: row.userId,
      metadata: { tokenId: row.id },
      reason: 'Email verified via emailed link',
    })
    .catch((err) => {
      console.error('[EmailVerification] Audit log failed:', err)
    })

  return { ok: true, userId: row.userId }
}

// ── Resend ───────────────────────────────────────────────────────

/**
 * Re-send the verification email for an already-signed-up user.
 * The route is responsible for rate-limiting (verificationResendRateLimit
 * in rate-limit-upstash.ts) and for returning a neutral response shape
 * (don't reveal whether the email exists in DB).
 */
export async function resendVerificationEmail(userId: string): Promise<{
  ok: boolean
  reason?: string
}> {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    // Don't reveal — the route returns success either way.
    return { ok: false, reason: 'user_not_found' }
  }
  if (user.emailVerifiedAt) {
    // Already verified — no-op.
    return { ok: false, reason: 'already_verified' }
  }

  return sendVerificationEmail({
    userId: user.id,
    email: user.email,
    name: user.name,
  })
}

// ── Cleanup ──────────────────────────────────────────────────────

/**
 * Delete tokens past their expiry + 7-day grace window. Cron helper.
 * Returns the number of rows deleted. Idempotent: re-running clears
 * any new expired rows that have crossed the threshold since.
 */
export async function cleanupExpiredTokens(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - CLEANUP_GRACE_MS)
  const deleted = await db
    .delete(emailVerificationTokens)
    .where(lt(emailVerificationTokens.expiresAt, cutoff))
    .returning({ id: emailVerificationTokens.id })
  return { deleted: deleted.length }
}

// ── Helpers for the route layer ──────────────────────────────────

/**
 * Lookup helper — used by the guard + the check-verification GET.
 * Returns null if user not found OR not verified; returns the timestamp
 * if verified. Callers should NOT differentiate "not found" from
 * "exists-but-unverified" in user-facing responses.
 */
export async function getEmailVerifiedAt(userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.emailVerifiedAt ?? null
}

// Re-export so any caller can use these consistently.
export { hashToken, getAppBaseUrl, TOKEN_EXPIRY_MS }
