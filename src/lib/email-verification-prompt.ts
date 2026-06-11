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

/**
 * Wrap a click/form handler so it short-circuits to the verification
 * prompt when the user is currently unverified.
 *
 * Usage in a client component:
 *
 *   const { isVerified } = useEmailVerification()
 *   const onSubmit = withVerificationGate(isVerified, () => doThing())
 *
 *   <button onClick={onSubmit} className={!isVerified ? 'opacity-60' : ''}>
 *     Submit
 *   </button>
 *
 * The wrapped handler accepts a synthetic event as its first argument
 * (so it slots cleanly into onClick / onSubmit / form-action props)
 * and calls `preventDefault()` on it when the gate fires. This avoids
 * default form-submit / link-follow behaviour after the prompt opens.
 */
export function withVerificationGate<
  H extends (event?: { preventDefault?: () => void }, ...rest: any[]) => any,
>(isVerified: boolean, handler: H): H {
  return ((event?: { preventDefault?: () => void }, ...rest: any[]) => {
    if (!isVerified) {
      event?.preventDefault?.()
      openEmailVerificationPrompt()
      return
    }
    return handler(event, ...rest)
  }) as H
}
