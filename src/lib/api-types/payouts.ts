import type { Serialized } from './serialized'

/**
 * GET /api/influencer/payouts
 *
 * ⚠️ THIS CATEGORY IS DIFFERENT — read before "improving" it to derive from the
 * service type like campaign-payments.ts does.
 *
 * This route does NOT return a service result. It builds a REDACTED PROJECTION
 * (`safePayouts`) and returns that. The sibling /api/payouts/accounts is the
 * clearer case: it decrypts account numbers and returns only MASKED forms,
 * deliberately omitting accountNumber, iban and encryptionKeyId.
 *
 * Deriving from the table or service type would therefore be actively wrong —
 * it would model the UNREDACTED shape as the contract, describing fields the
 * route exists to strip. The response type must describe the projection.
 *
 * WHY HAND-WRITING IS SAFE HERE, when the pattern elsewhere warns against it:
 * hand-written types drift silently ONLY WHEN NOTHING CHECKS THEM. The route
 * annotates its projection with this type, so contextual typing applies excess
 * property checking to the mapped object literal — adding a raw `accountNumber`
 * to the projection becomes a COMPILE ERROR rather than a silent leak. The
 * check is what makes the duplication safe; remove the annotation and this
 * becomes exactly the drift the pattern exists to prevent.
 */
export type InfluencerPayoutProjection = {
  id: string
  campaignId: string | null
  amount: number
  currency: string
  payoutMethod: string
  // Narrow union, not `string` — mirrors the column's own $type<> and lets
  // consumers index a Record<PayoutStatus, …> without a cast. Widening this to
  // `string` would silently break those lookups at the call site.
  status: 'pending' | 'processing' | 'completed' | 'failed'
  failureReason?: string | null
  retryCount: number
  initiatedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

/**
 * ⚠️ Serialized<> is NOT a no-op here, unlike influencer-earnings: initiatedAt,
 * completedAt and createdAt are genuine `Date` values on the server and arrive
 * as strings. A page importing InfluencerPayoutProjection directly would
 * believe it holds Dates and throw on the first `.getTime()`.
 */
export type InfluencerPayoutsResponse = Serialized<{
  payouts: InfluencerPayoutProjection[]
  page: number
  limit: number
}>

/** One payout row as the client receives it. */
export type InfluencerPayoutRow = InfluencerPayoutsResponse['payouts'][number]
