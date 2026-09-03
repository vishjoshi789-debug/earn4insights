/**
 * GET /api/admin/payouts/pending
 *
 * Returns all pending and processing payouts for admin review.
 * Used by the admin payout queue UI.
 *
 * Auth: admin role only
 */

import type {
  AdminPendingPayoutProjection,
  AdminPayoutAccountFields,
} from '@/lib/api-types/payouts'
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getAdminPayoutQueue } from '@/db/repositories/razorpayRepository'
import { getAccountById } from '@/db/repositories/payoutAccountRepository'
import { decryptFromStorage } from '@/lib/encryption'
import { db } from '@/db'
import { users } from '@/db/schema'
import { inArray } from 'drizzle-orm'

/** Decrypt an encrypted value and show only last 4 chars. */
async function decryptAndMask(
  encryptedValue: string | null,
  encryptionKeyId: string | null
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

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = session.user as any
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const payouts = await getAdminPayoutQueue()

    if (payouts.length === 0) {
      return NextResponse.json({ payouts: [] })
    }

    // Fetch recipient names for display
    const recipientIds = [...new Set(payouts.map((p) => p.recipientId))]
    const recipientRows = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, recipientIds))

    const recipientMap = Object.fromEntries(recipientRows.map((r) => [r.id, r]))

    // Fetch payout accounts (masked) for display
    // Annotated so the OUTER shape is checked — a new top-level field cannot
    // appear silently. See the type: this protects less than the sibling
    // projection. accountDisplay is gone — the account field is now discrete
    // masked fields, so the redaction is type-checked like its sibling.
    const enrichedPayouts: AdminPendingPayoutProjection[] = await Promise.all(
      payouts.map(async (payout) => {
        const recipient = recipientMap[payout.recipientId]
        // ⚠️ DISCRETE MASKED FIELDS, NOT A CONCATENATED STRING.
        //
        // This previously built `accountDisplay` as a template literal:
        //   `Bank: ${holder} | IFSC: ${ifsc} | A/C: ${maskedAccNum ?? '—'}`
        //
        // That defeated the protection the rest of this work exists to provide.
        // `accountDisplay: string` says nothing about its contents, so swapping
        // maskedAccNum for account.accountNumber — the DECRYPTED value, already
        // in scope — was a one-line edit no type system could catch, on the
        // most PII-dense endpoint in the codebase.
        //
        // Returning discrete fields typed by AdminPayoutAccountFields (a Pick<>
        // of the redaction-checked PayoutAccountProjection) means an unmasked
        // field cannot be added without an excess-property error. The admin
        // page composes the display string from these.
        let account: AdminPayoutAccountFields | null = null

        try {
          // Get account by ID directly (admin context)
          const acc = payout.payoutAccountId
            ? await getAccountById(payout.payoutAccountId, payout.recipientId)
            : null

          if (acc) {
            account = {
              accountType: acc.accountType,
              accountHolderName: acc.accountHolderName,
              // The ONLY form of the account number that leaves this route.
              accountNumberMasked: await decryptAndMask(acc.accountNumber, acc.encryptionKeyId),
              ifscCode: acc.ifscCode,
              upiId: acc.upiId,
              paypalEmail: acc.paypalEmail,
              wiseEmail: acc.wiseEmail,
              swiftCode: acc.swiftCode,
              bankName: acc.bankName,
              bankCountry: acc.bankCountry,
              currency: acc.currency,
            }
          }
        } catch {
          // Non-fatal — account details are best-effort
        }

        return {
          id: payout.id,
          recipientId: payout.recipientId,
          recipientName: recipient?.name ?? 'Unknown',
          recipientEmail: recipient?.email ?? '',
          recipientType: payout.recipientType,
          campaignId: payout.campaignId,
          amount: payout.amount,
          currency: payout.currency,
          payoutMethod: payout.payoutMethod,
          status: payout.status,
          account,
          retryCount: payout.retryCount,
          failureReason: payout.failureReason,
          adminNote: payout.adminNote,
          createdAt: payout.createdAt,
          initiatedAt: payout.initiatedAt,
        }
      })
    )

    return NextResponse.json({ payouts: enrichedPayouts })
  } catch (error) {
    console.error('[AdminPayoutsPending GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
