import type { Serialized } from './serialized'

/**
 * The admin payout-request queue projection.
 *
 * ⚠️ THIS IS A REDACTION BOUNDARY, like AdminPendingPayoutRow. It joins a
 * consumer's identity (name, email) to a money movement, so the fields listed
 * here are the complete set the route is permitted to send. The route
 * ANNOTATES its response with this type, so excess-property checking rejects
 * any field added at the query without a corresponding decision here — which
 * is what makes the boundary enforceable rather than aspirational.
 *
 * Do NOT derive this from the schema row type. Deriving would make the
 * redaction look like a deviation from the contract rather than the contract
 * itself, and someone would eventually "fix" it by widening to the source.
 */
export type AdminPayoutRequestPayload = {
  id: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  points: number
  /** Rupees, as a decimal string. See lib/points/rate — 1 point = ₹0.10. */
  amount: string
  status: 'pending' | 'approved' | 'paid' | 'denied'
  requestedAt: Date
  processedAt: Date | null
  paidAt: Date | null
  paymentReference: string | null
  note: string | null
  /**
   * The consumer's primary payout account, masked.
   *
   * ⚠️ MASKED ONLY. There is deliberately no unmasked field on this type to
   * read — an admin needs to know WHERE to send money, not the full account
   * number. Same rule as the influencer queue: decrypt-then-slice happens
   * server-side and only the last four ever cross this boundary.
   */
  account: {
    accountType: string
    upiId: string | null
    accountNumberMasked: string | null
    bankName: string | null
    accountHolderName: string | null
  } | null
}

/** What the page receives — Date becomes string across the JSON boundary. */
export type AdminPayoutRequestRow = Serialized<AdminPayoutRequestPayload>

/** Actions the admin queue can take on a request. */
export type PayoutRequestAction = 'approve' | 'pay' | 'deny'
