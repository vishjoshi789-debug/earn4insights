import 'server-only'

import { db } from '@/db'
import {
  payoutAccounts,
  type PayoutAccount,
  type NewPayoutAccount,
} from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ── Read ─────────────────────────────────────────────────────────

export async function getPayoutAccounts(
  userId: string,
  userRole?: 'influencer' | 'consumer'
): Promise<PayoutAccount[]> {
  const conditions = [
    eq(payoutAccounts.userId, userId),
    eq(payoutAccounts.isActive, true),
  ]
  if (userRole) {
    conditions.push(eq(payoutAccounts.userRole, userRole))
  }
  return db
    .select()
    .from(payoutAccounts)
    .where(and(...conditions))
    .orderBy(desc(payoutAccounts.isPrimary), desc(payoutAccounts.createdAt))
}

export async function getPrimaryAccount(
  userId: string,
  currency: string
): Promise<PayoutAccount | null> {
  const rows = await db
    .select()
    .from(payoutAccounts)
    .where(
      and(
        eq(payoutAccounts.userId, userId),
        eq(payoutAccounts.currency, currency),
        eq(payoutAccounts.isPrimary, true),
        eq(payoutAccounts.isActive, true)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

export async function getAccountById(
  id: string,
  userId: string
): Promise<PayoutAccount | null> {
  const rows = await db
    .select()
    .from(payoutAccounts)
    .where(
      and(
        eq(payoutAccounts.id, id),
        eq(payoutAccounts.userId, userId),
        eq(payoutAccounts.isActive, true)
      )
    )
    .limit(1)
  return rows[0] ?? null
}

// ── Create ───────────────────────────────────────────────────────

export async function createPayoutAccount(
  data: Omit<NewPayoutAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PayoutAccount> {
  const [row] = await db
    .insert(payoutAccounts)
    .values(data)
    .returning()
  return row
}

// ── Update ───────────────────────────────────────────────────────

export async function updatePayoutAccount(
  id: string,
  userId: string,
  data: Partial<Pick<
    PayoutAccount,
    'accountHolderName' | 'accountNumber' | 'ifscCode' | 'upiId' |
    'paypalEmail' | 'wiseEmail' | 'swiftCode' | 'iban' |
    'bankName' | 'bankCountry' | 'currency' | 'encryptionKeyId'
  >>
): Promise<PayoutAccount> {
  const [updated] = await db
    .update(payoutAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(payoutAccounts.id, id),
        eq(payoutAccounts.userId, userId),
        eq(payoutAccounts.isActive, true)
      )
    )
    .returning()

  if (!updated) throw new Error(`Payout account not found: ${id}`)
  return updated
}

/**
 * Set an account as primary for its currency.
 * Unsets any other primary account for the same user+currency first.
 * Wrapped in a transaction to prevent race conditions.
 */
export async function setPrimaryAccount(
  id: string,
  userId: string
): Promise<PayoutAccount> {
  // Get the account to find its currency
  const account = await getAccountById(id, userId)
  if (!account) throw new Error(`Payout account not found: ${id}`)

  // Transaction: unset old primary + set new primary atomically
  const result = await db.transaction(async (tx) => {
    // Unset other primaries for same user+currency
    await tx
      .update(payoutAccounts)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(
        and(
          eq(payoutAccounts.userId, userId),
          eq(payoutAccounts.currency, account.currency),
          eq(payoutAccounts.isActive, true)
        )
      )

    // Set this one as primary
    const [updated] = await tx
      .update(payoutAccounts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(payoutAccounts.id, id))
      .returning()

    return updated
  })

  return result
}

/**
 * Soft delete — sets is_active = false.
 * If this was the primary account, no replacement is auto-selected.
 */
export async function deletePayoutAccount(
  id: string,
  userId: string
): Promise<PayoutAccount> {
  const [updated] = await db
    .update(payoutAccounts)
    .set({ isActive: false, isPrimary: false, updatedAt: new Date() })
    .where(
      and(
        eq(payoutAccounts.id, id),
        eq(payoutAccounts.userId, userId),
        eq(payoutAccounts.isActive, true)
      )
    )
    .returning()

  if (!updated) throw new Error(`Payout account not found: ${id}`)
  return updated
}

/**
 * Mark account as verified (admin action).
 */
export async function verifyAccount(id: string): Promise<PayoutAccount> {
  const [updated] = await db
    .update(payoutAccounts)
    .set({ isVerified: true, verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(payoutAccounts.id, id))
    .returning()

  if (!updated) throw new Error(`Payout account not found: ${id}`)
  return updated
}
