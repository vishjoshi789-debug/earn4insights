/**
 * The payment kill-switch.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * There is a standing rule that no brand makes a real payment until the
 * campaign_payments ledger gap is fixed AND an end-to-end rehearsal passes.
 * Until now that rule lived only in `SESSION_RESUME.md`. Nothing in the code
 * stopped a brand from clicking "Create Payment Order" — the app runs on LIVE
 * Razorpay keys (`rzp_live_…`), so a click took real money, and the
 * campaign-level path creates NO `campaign_payments` row, so the money would
 * have been taken with no ledger entry, no escrow total and nothing for the
 * refund sync to act on.
 *
 * A rule you have to remember is not a control. This makes it one.
 *
 * ── Default is OFF ───────────────────────────────────────────────────────
 * `PAYMENTS_ENABLED` must be explicitly `'true'` to permit orders. Anything
 * else — unset, empty, 'false', a typo — disables payments. Fail-safe: the
 * cost of being wrongly disabled is a brand emailing us; the cost of being
 * wrongly enabled is taking money we cannot account for.
 *
 * Safe to default off today because no brand has ever paid: production has
 * zero `campaign_payments` rows.
 *
 * ── To re-enable ─────────────────────────────────────────────────────────
 * Set `PAYMENTS_ENABLED=true` (server) and `NEXT_PUBLIC_PAYMENTS_ENABLED=true`
 * (client, for the UI) in Vercel, then redeploy — env changes only bind on a
 * fresh deploy after the save.
 *
 * ⚠️ Do not flip it to unblock a single eager brand. The gate exists because
 * of a specific unfixed defect; invoice manually instead.
 */

/** Server-side check. The enforcement — `create-order` refuses when false. */
export function arePaymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === 'true'
}

/**
 * Client-side mirror, for hiding the button.
 *
 * ⚠️ This is COSMETIC ONLY. `NEXT_PUBLIC_*` is inlined into the browser
 * bundle and trivially bypassed, so it must never be the only thing standing
 * between a user and a charge. The real gate is `arePaymentsEnabled()` on the
 * server. Keeping both means the UI doesn't offer a button that would fail —
 * the same "enforce in the action, be courteous in the page" split used for
 * paused surveys.
 */
export function arePaymentsEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === 'true'
}

/** Shown to a brand who reaches the disabled path. No blame, no jargon. */
export const PAYMENTS_DISABLED_MESSAGE =
  'Online payment is temporarily unavailable while we complete billing setup. ' +
  'Please contact us at contact@earn4insights.com and we will invoice you directly.'
