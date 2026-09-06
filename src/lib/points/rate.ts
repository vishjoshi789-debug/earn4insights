/**
 * THE POINTS → MONEY RATE. ONE DEFINITION FOR SERVER **AND** CLIENT.
 *
 * 1 point = 10 paise = ₹0.10   (10 points = ₹1)
 *
 * ⚠️ Lives in lib/, not in server/pointsService, because CLIENT pages need it
 * too — /dashboard/payouts and /dashboard/rewards both display a cash value.
 * pointsService imports `db` and the full schema, so importing it from a
 * 'use client' page would drag the database layer into the browser bundle.
 * Same reasoning as lib/api-types: a neutral module removes the temptation
 * structurally rather than relying on discipline.
 *
 * ⚠️ There used to be TWO rates, both live:
 *
 *   /api/payouts + /dashboard/payouts    100 points = $1   (≈ ₹83)
 *   /api/consumer/rewards/redeem
 *     + /dashboard/rewards               1 point = 10 paise
 *
 * The same balance was quoted ~8x apart on two consumer screens, and the same
 * points were worth ~₹500 or ₹60 depending only on which page was used. Both
 * paths deducted points. `POINTS_PER_DOLLAR = 100` produced the "6.00"
 * recorded on the two pending payout_requests rows.
 *
 * ₹0.10 is authoritative: it is what /dashboard/rewards has always shown, it
 * matches POINTS_PER_INR = 10 in CLAUDE.md, and the unit economics survive it
 * — at the USD rate a brand generating 50 media-rich feedback items a month
 * costs more in consumer rewards than a ₹6,600 Pro subscription brings in.
 *
 * Converged with no compensation owed: production had 2 payout requests, both
 * PENDING, 0 approved, 0 denied, and 0 reward_redemptions. Nobody had been
 * paid by either route, so there was no promise to honour and nothing to
 * reverse.
 *
 * ⚠️ Money is stored in PAISE everywhere (§5 CLAUDE.md) — integer, no float
 * drift. Keep the canonical constant as paise-per-point.
 */
export const PAISE_PER_POINT = 10

/** For display layers that need rupees. Storage stays in paise. */
export const POINTS_TO_RUPEES = PAISE_PER_POINT / 100

/** Minimum points redeemable in one request (= ₹50). */
export const MINIMUM_REDEMPTION_POINTS = 500
