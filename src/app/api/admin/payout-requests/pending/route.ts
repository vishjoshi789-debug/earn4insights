/**
 * GET /api/admin/payout-requests/pending
 *
 * The admin queue for `payout_requests` — the consumer points-cash-out path.
 *
 * ⚠️ THIS TABLE HAD NO ADMIN SURFACE AT ALL. `/admin/payouts` reads
 * `influencer_payouts`, a DIFFERENT table, so consumer payout requests were
 * invisible: a consumer's points were deducted at request time and the row sat
 * unreadable by anyone who could act on it. The oldest request had been pending
 * for over six weeks, not through neglect but because no page listed it.
 *
 * Auth: admin only, via isAdminSession() — the single home for that cast.
 */
import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { db } from '@/db'
import { payoutRequests, users, payoutAccounts } from '@/db/schema'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { decryptFromStorage } from '@/lib/encryption'
import type { AdminPayoutRequestPayload } from '@/lib/api-types/payout-requests'

/**
 * Decrypt an encrypted value and show only the last 4 characters.
 *
 * ⚠️ Decrypt BEFORE slicing. `accountNumber.slice(-4)` on ciphertext leaks four
 * characters of ciphertext, not the last four digits — a §5 rule, and it looks
 * correct in review either way.
 *
 * Fails to a mask, never to the raw value: a decryption error must not become a
 * disclosure.
 */
async function decryptAndMask(
  encryptedValue: string | null,
  encryptionKeyId: string | null,
): Promise<string | null> {
  if (!encryptedValue || !encryptionKeyId) return null
  try {
    const plaintext = await decryptFromStorage(encryptedValue, encryptionKeyId)
    if (plaintext.length <= 4) return '••••'
    return '••••' + plaintext.slice(-4)
  } catch {
    return '••••****'
  }
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    // Open requests first (pending, approved-but-unpaid), then recent history.
    const rows = await db
      .select({
        id: payoutRequests.id,
        userId: payoutRequests.userId,
        points: payoutRequests.points,
        amount: payoutRequests.amount,
        status: payoutRequests.status,
        requestedAt: payoutRequests.requestedAt,
        processedAt: payoutRequests.processedAt,
        paidAt: payoutRequests.paidAt,
        paymentReference: payoutRequests.paymentReference,
        note: payoutRequests.note,
      })
      .from(payoutRequests)
      .orderBy(
        // Unfinished work sorts to the top regardless of age.
        sql`CASE WHEN ${payoutRequests.status} IN ('pending','approved') THEN 0 ELSE 1 END`,
        desc(payoutRequests.requestedAt),
      )
      .limit(100)

    // ⚠️ user_id is NULLABLE — SET NULL on erasure (031), so a request from a
    // since-deleted account survives as money history with no owner. Filter the
    // nulls out of the lookup rather than letting them reach inArray, which
    // would build `IN ()` and match nothing silently.
    const recipientIds = [...new Set(rows.map((r) => r.userId).filter((id): id is string => !!id))]

    const people = recipientIds.length
      ? await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, recipientIds))
      : []
    const personById = new Map(people.map((p) => [p.id, p]))

    const accounts = recipientIds.length
      ? await db
          .select()
          .from(payoutAccounts)
          .where(
            and(
              inArray(payoutAccounts.userId, recipientIds),
              eq(payoutAccounts.isPrimary, true),
              eq(payoutAccounts.isActive, true),
            ),
          )
      : []
    const accountByUser = new Map(accounts.map((a) => [a.userId, a]))

    // ⚠️ ANNOTATED with the shared projection type. This is what makes the
    // redaction boundary enforceable: adding a field to the select above
    // without adding it to AdminPayoutRequestPayload is a compile error, so an
    // unmasked account number cannot be introduced quietly.
    const requests: AdminPayoutRequestPayload[] = await Promise.all(
      rows.map(async (r) => {
        const person = r.userId ? personById.get(r.userId) : undefined
        const acc = r.userId ? accountByUser.get(r.userId) : undefined
        return {
          id: r.id,
          userId: r.userId,
          userName: person?.name ?? null,
          userEmail: person?.email ?? null,
          points: r.points,
          amount: r.amount,
          status: r.status as AdminPayoutRequestPayload['status'],
          requestedAt: r.requestedAt,
          processedAt: r.processedAt,
          paidAt: r.paidAt,
          paymentReference: r.paymentReference,
          note: r.note,
          account: acc
            ? {
                accountType: acc.accountType,
                upiId: acc.upiId,
                accountNumberMasked: await decryptAndMask(acc.accountNumber, acc.encryptionKeyId),
                bankName: acc.bankName,
                accountHolderName: acc.accountHolderName,
              }
            : null,
        }
      }),
    )

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[AdminPayoutRequests GET]', error)
    return NextResponse.json({ error: 'Failed to load payout requests' }, { status: 500 })
  }
}
