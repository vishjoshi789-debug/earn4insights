import 'server-only'

import { getEmailVerifiedAt } from '@/server/emailVerificationService'

/**
 * Email verification guard (Phase EV.1).
 *
 * Mirrors the `enforceConsent(userId, category, op)` pattern from
 * `@/lib/consent-enforcement`. Server-side check called at the head of
 * action handlers / API route handlers for the 7 hard-block routes.
 *
 * 7 hard-block routes (per user spec Q5):
 *   1. /api/feedback/submit            POST — feeds into analytics
 *   2. /api/consumer/rewards/redeem    POST — financial action
 *   3. /api/marketplace/campaigns/[id]/apply  POST — legal / contractual
 *   4. /api/influencer/verification/request  POST — A9, future
 *   5. /api/payouts/accounts           POST — financial
 *   6. /api/brand/campaigns            POST — financial
 *   7. /api/payments/create-order      POST — financial
 *
 * Every other route is soft-nudged via the banner only.
 *
 * Routes catch the error → return structured 403:
 *   {
 *     error: 'Email verification required',
 *     code: 'EMAIL_NOT_VERIFIED',
 *     cta: '/dashboard/settings'
 *   }
 *
 * Client UI intercepts this code (same pattern as A10
 * PAYOUT_ACCOUNT_REQUIRED) to open a "verify email" modal/banner with
 * a one-click "Resend verification email" button.
 */
export class EmailNotVerifiedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Email verification required')
    this.name = 'EmailNotVerifiedError'
  }
}

/**
 * Throws EmailNotVerifiedError if the user's email is not yet verified.
 * Returns silently when verified.
 *
 * Lookup is a single-row SELECT; cheap enough to call at the head of
 * every hard-block route. No caching — verification status is the kind
 * of fact a user expects to apply immediately after the verify click.
 */
export async function requireEmailVerified(userId: string): Promise<void> {
  if (!userId) {
    throw new EmailNotVerifiedError('Not signed in')
  }
  const verifiedAt = await getEmailVerifiedAt(userId)
  if (!verifiedAt) {
    throw new EmailNotVerifiedError()
  }
}

/**
 * Structured 403 body for routes that catch EmailNotVerifiedError.
 * Keeps the response shape consistent across all 7 hard-block routes
 * so the client's interceptor can handle them uniformly.
 */
export function emailNotVerifiedResponseBody() {
  return {
    error: 'Email verification required',
    code: 'EMAIL_NOT_VERIFIED' as const,
    cta: '/dashboard/settings',
  }
}
