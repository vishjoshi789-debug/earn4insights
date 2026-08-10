import 'server-only'

import { db } from '@/db'
import { emailDeliveries, emailSuppressions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * Email delivery truth (migration 035).
 *
 * Everything here is written to be NON-FATAL. Recording that an email was
 * sent must never be the reason an email fails to send — the observability
 * layer breaking would be strictly worse than the blindness it replaces.
 * Every function swallows its own errors and logs.
 *
 * The one deliberate exception is `isEmailSuppressed`, which FAILS OPEN
 * (returns false on error): if the suppression check itself breaks we send
 * the mail, because a false suppression is a silent block on a real user —
 * exactly the failure mode this whole feature exists to eliminate.
 */

export type EmailType =
  | 'verification'
  | 'notification'
  | 'influencer_verification'

export type DeliveryStatus =
  | 'accepted'    // Resend took it. This is what 'sent' used to mean.
  | 'delivered'   // webhook: actually landed
  | 'bounced'     // webhook: mailbox rejected it
  | 'complained'  // webhook: recipient pressed "spam"
  | 'delayed'     // webhook: deferred, may still land
  | 'suppressed'  // we refused to send — address is on the suppression list
  | 'failed'      // the send call threw

const norm = (email: string) => email.trim().toLowerCase()

// ── Writes ────────────────────────────────────────────────────────────────

/**
 * Record a send attempt. Call this for EVERY outbound email, including ones
 * that bypass notification_queue (verification, influencer verification).
 *
 * Returns the row id, or null if recording failed — callers ignore the
 * result; it exists for tests.
 */
export async function recordEmailSend(params: {
  providerMessageId?: string | null
  userId?: string | null
  toEmail: string
  emailType: EmailType
  subject?: string | null
  notificationQueueId?: string | null
  status?: DeliveryStatus
  detail?: string | null
}): Promise<string | null> {
  try {
    const [row] = await db
      .insert(emailDeliveries)
      .values({
        providerMessageId: params.providerMessageId ?? null,
        userId: params.userId ?? null,
        toEmail: norm(params.toEmail),
        emailType: params.emailType,
        subject: params.subject ?? null,
        notificationQueueId: params.notificationQueueId ?? null,
        status: params.status ?? 'accepted',
        detail: params.detail ?? null,
      })
      .returning({ id: emailDeliveries.id })
    return row?.id ?? null
  } catch (err) {
    console.error('[EmailDelivery] Failed to record send (non-fatal):', err)
    return null
  }
}

/**
 * Apply a webhook event to the matching delivery row.
 *
 * Resend can deliver the same event more than once, and events can arrive
 * out of order (a `delivered` after a `bounced` for a multi-recipient
 * message). `TERMINAL` states are therefore never overwritten by a
 * non-terminal one — a bounce that later receives a stray `delayed` must
 * stay bounced, or the suppression it justified looks unfounded.
 */
const TERMINAL: DeliveryStatus[] = ['bounced', 'complained']

export async function applyDeliveryEvent(params: {
  providerMessageId: string
  status: DeliveryStatus
  detail?: string | null
}): Promise<boolean> {
  try {
    const rows = await db
      .update(emailDeliveries)
      .set({
        status: params.status,
        detail: params.detail ?? null,
        updatedAt: new Date(),
      })
      .where(
        sql`${emailDeliveries.providerMessageId} = ${params.providerMessageId}
            AND ${emailDeliveries.status} NOT IN ('bounced', 'complained')`
      )
      .returning({ id: emailDeliveries.id })

    if (rows.length === 0) {
      // Either unknown message id (sent before 035, or from another system)
      // or already terminal. Both are expected; log at info level only.
      console.log(
        `[EmailDelivery] No non-terminal row for ${params.providerMessageId} (${params.status})`
      )
    }
    return rows.length > 0
  } catch (err) {
    console.error('[EmailDelivery] Failed to apply event (non-fatal):', err)
    return false
  }
}

/**
 * Add an address to the suppression list. Idempotent — re-suppressing an
 * address refreshes `last_event_at` and keeps the original `first_seen_at`,
 * so "how long has this been broken?" stays answerable.
 */
export async function suppressEmail(params: {
  email: string
  reason: 'bounced' | 'complained' | 'manual'
  detail?: string | null
}): Promise<void> {
  try {
    await db
      .insert(emailSuppressions)
      .values({
        email: norm(params.email),
        reason: params.reason,
        detail: params.detail ?? null,
      })
      .onConflictDoUpdate({
        target: emailSuppressions.email,
        set: {
          reason: params.reason,
          detail: params.detail ?? null,
          lastEventAt: new Date(),
        },
      })
    console.warn(
      `[EmailDelivery] SUPPRESSED ${norm(params.email)} (${params.reason}) — ` +
      `this address will receive no further email until removed`
    )
  } catch (err) {
    console.error('[EmailDelivery] Failed to suppress (non-fatal):', err)
  }
}

/** Remove an address from the suppression list (after the user fixes it). */
export async function unsuppressEmail(email: string): Promise<void> {
  try {
    await db.delete(emailSuppressions).where(eq(emailSuppressions.email, norm(email)))
  } catch (err) {
    console.error('[EmailDelivery] Failed to unsuppress (non-fatal):', err)
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────

/**
 * Should we refuse to send to this address?
 *
 * ⚠️ FAILS OPEN. If this check throws we return false and send anyway. A
 * suppression list that breaks closed would silently block real users —
 * the precise failure this feature exists to make impossible.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, norm(email)))
      .limit(1)
    return rows.length > 0
  } catch (err) {
    console.error('[EmailDelivery] Suppression check failed — FAILING OPEN:', err)
    return false
  }
}

export async function listSuppressions(): Promise<
  Array<{ email: string; reason: string; detail: string | null; firstSeenAt: Date; lastEventAt: Date }>
> {
  return db
    .select({
      email: emailSuppressions.email,
      reason: emailSuppressions.reason,
      detail: emailSuppressions.detail,
      firstSeenAt: emailSuppressions.firstSeenAt,
      lastEventAt: emailSuppressions.lastEventAt,
    })
    .from(emailSuppressions)
    .orderBy(emailSuppressions.lastEventAt)
}
