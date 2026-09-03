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

/**
 * GET /api/payouts/accounts
 *
 * ⚠️⚠️ THIS IS A REDACTION BOUNDARY, NOT JUST A RESPONSE SHAPE.
 *
 * The route decrypts stored account numbers and returns only MASKED forms
 * (`accountNumberMasked`, `ibanMasked`), deliberately omitting the raw
 * `accountNumber`, `iban` and `encryptionKeyId`. Those omissions are the whole
 * point of the projection.
 *
 * So this type must NEVER be derived from `influencer_payout_accounts` or from
 * a service returning the row: a derived type would model the UNREDACTED shape
 * as the published contract, describing exactly the fields the route exists to
 * strip — and inviting a page to read one.
 *
 * The route annotates its projection with this type, so contextual typing
 * applies excess property checking to the mapped object literal. Adding
 * `accountNumber: acc.accountNumber` to that map becomes a COMPILE ERROR
 * rather than a silent leak of decrypted banking data. The annotation is what
 * makes hand-writing this safe; without it, this is the drift the pattern
 * exists to prevent.
 *
 * ⚠️ Serialized<> is LOAD-BEARING here — `createdAt` is a real Date server-side.
 */
export type PayoutAccountProjection = {
  id: string
  accountType: 'bank_account' | 'upi' | 'paypal' | 'wise' | 'swift'
  userRole: string
  currency: string
  isPrimary: boolean
  isVerified: boolean
  accountHolderName: string | null
  accountNumberMasked: string | null
  ifscCode: string | null
  upiId: string | null
  paypalEmail: string | null
  wiseEmail: string | null
  swiftCode: string | null
  ibanMasked: string | null
  bankName: string | null
  bankCountry: string | null
  createdAt: Date
}

/** One payout account as the client receives it. */
export type PayoutAccountRow = Serialized<PayoutAccountProjection>

/**
 * GET /api/admin/payouts/pending — the admin manual-payout queue.
 *
 * ⚠️ THE MOST PII-DENSE PROJECTION IN THE CODEBASE. It carries recipient name
 * and email ALONGSIDE banking details, and it decrypts stored account numbers
 * (`decryptFromStorage`) before masking them. Same rule as
 * PayoutAccountProjection: describe the PROJECTION, never derive from the
 * account/user rows — a derived type would name `accountNumber`, `iban` and
 * `encryptionKeyId`, making the redaction look like a deviation from the
 * contract rather than the contract itself.
 *
 * ⚠️⚠️ BUT THE ANNOTATION PROTECTS LESS HERE THAN IT DOES FOR
 * PayoutAccountProjection, AND THAT IS WORTH UNDERSTANDING BEFORE RELYING ON IT.
 *
 * This route does not return structured masked fields. It CONCATENATES them
 * into one display string:
 *
 *   accountDisplay = `Bank: ${holderName} | IFSC: ${ifsc} | A/C: ${maskedAccNum}`
 *
 * So `accountDisplay: string` says nothing about what is inside it. Adding the
 * UNMASKED number to that template is a one-line edit that no type can catch —
 * the excess-property check that makes the sibling projection safe simply does
 * not apply inside a template literal. The type still pins the OUTER shape (a
 * new top-level field cannot appear silently), which is why it is worth having,
 * but the string's contents remain guarded only by review.
 *
 * Restructuring accountDisplay into discrete fields would make its redaction
 * type-checkable. Deliberately NOT done — founder decision 2026-09-03; it is a
 * behaviour change to a live admin surface, not a typing change.
 *
 * ⚠️ Serialized<> is load-bearing — createdAt and initiatedAt are real Dates.
 */
export type AdminPendingPayoutProjection = {
  id: string
  recipientId: string
  recipientName: string
  recipientEmail: string
  // Narrow unions, mirroring the columns' own $type<> — consumers index
  // Record<PayoutStatus, …> and switch on recipientType without casts.
  recipientType: 'influencer' | 'consumer'
  campaignId: string | null
  amount: number
  currency: string
  payoutMethod: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** Pre-masked, pre-flattened. See the warning above: contents are not type-checked. */
  accountDisplay: string | null
  retryCount: number
  failureReason: string | null
  adminNote: string | null
  createdAt: Date
  initiatedAt: Date | null
}

/** One admin queue row as the client receives it. */
export type AdminPendingPayoutRow = Serialized<AdminPendingPayoutProjection>
