/**
 * Manually open the global EmailNotVerifiedModal.
 *
 * The modal in dashboard/layout.tsx listens for the
 * `e4i:email-not-verified` window event. EV.2's api-client dispatches
 * it automatically on 403 responses; EV.3's Layer-4 disabled buttons
 * use this helper to trigger the same modal WITHOUT making a network
 * call (the action is already known to be blocked client-side).
 *
 * The detail shape matches the structured 403 body emitted by
 * src/server/emailVerificationGuard.ts → emailNotVerifiedResponseBody:
 *
 *   { error: string, code: 'EMAIL_NOT_VERIFIED', cta: '/dashboard/settings' }
 *
 * The modal only opens when detail.code === 'EMAIL_NOT_VERIFIED', so
 * passing a complete payload keeps the trigger paths symmetric.
 */
export function openEmailVerificationPrompt(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('e4i:email-not-verified', {
      detail: {
        error: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
        cta: '/dashboard/settings',
      },
    }),
  )
}
