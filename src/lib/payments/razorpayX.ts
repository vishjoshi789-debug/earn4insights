/**
 * RazorpayX (automatic payouts) — availability flag.
 *
 * ⚠️ THIS IS A BUILD-TIME CONSTANT, NOT AN ENVIRONMENT VARIABLE, AND THAT IS
 * DELIBERATE. Do not "fix" it into `process.env.RAZORPAYX_ENABLED`.
 *
 * Three places used to disagree about this, which is why it now has a home:
 *   - payoutService.ts held `const RAZORPAYX_ENABLED = false` (the truth)
 *   - CLAUDE.md described it as env-flag controlled (wrong)
 *   - /api/admin/env-check reported `process.env.RAZORPAYX_ENABLED` (always
 *     null, because nothing ever set it — so the diagnostic implied the
 *     feature was merely unconfigured rather than unbuilt)
 *
 * WHY A CONSTANT: the Razorpay Payouts API call **is not implemented**. Inside
 * `initiateRecipientPayout` the RazorpayX branch is a TODO that falls straight
 * through to `status = 'pending'`. So an env var here would be a control that
 * appears to enable automatic payouts and silently does nothing — the exact
 * false-affordance pattern in §5, and the same class of defect as the alert
 * toggles with no emitter and the "Escrow" button deleted in Phase 1.
 *
 * Flipping this to `true` is therefore NOT a configuration change. It is a
 * code change that must ship together with:
 *   1. the razorpayXCreatePayout() implementation,
 *   2. status polling in syncPayoutStatus(),
 *   3. an approved RazorpayX account.
 *
 * Until all three exist, every payout goes to the admin manual queue at
 * /admin/payouts with status 'pending' — which is the current, correct,
 * intended behaviour.
 */
export const RAZORPAYX_ENABLED = false as boolean

/** Human-readable state for diagnostics. Never implies "just set an env var". */
export const RAZORPAYX_STATUS = RAZORPAYX_ENABLED
  ? 'enabled (automatic payouts)'
  : 'disabled — build-time constant, not env-configurable; API call unimplemented; all payouts go to the admin manual queue'
