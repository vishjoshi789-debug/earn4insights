/**
 * GET /api/admin/payouts/pending
 *
 * Returns all pending and processing payouts for admin review.
 * Used by the admin payout queue UI.
 *
 * Auth: admin role only
 */

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
    const enrichedPayouts = await Promise.all(
      payouts.map(async (payout) => {
        const recipient = recipientMap[payout.recipientId]
        let accountDisplay: string | null = null

        try {
          // Get account by ID directly (admin context)
          const account = payout.payoutAccountId
            ? await getAccountById(payout.payoutAccountId, payout.recipientId)
            : null

          if (account) {
            const maskedAccNum = await decryptAndMask(account.accountNumber, account.encryptionKeyId)
            switch (account.accountType) {
              case 'upi':
                accountDisplay = `UPI: ${account.upiId}`
                break
              case 'bank_account':
                accountDisplay = `Bank: ${account.accountHolderName} | IFSC: ${account.ifscCode} | A/C: ${maskedAccNum ?? '—'}`
                break
              case 'paypal':
                accountDisplay = `PayPal: ${account.paypalEmail}`
                break
              case 'wise':
                accountDisplay = `Wise: ${account.wiseEmail} (${account.currency})`
                break
              case 'swift':
                accountDisplay = `SWIFT: ${account.swiftCode} | ${account.bankName}, ${account.bankCountry}`
                break
            }
          }
        } catch {
          // Non-fatal — account display is best-effort
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
          accountDisplay,
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
