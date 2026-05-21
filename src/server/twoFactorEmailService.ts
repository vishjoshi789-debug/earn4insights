import 'server-only'

/**
 * Two-Factor Authentication email alerts.
 *
 * Security notifications sent to the account owner when 2FA state
 * changes: enabled, disabled, a recovery code used, a new device
 * trusted, or the account locked after too many failed challenges.
 *
 * Same Resend client + fail-soft pattern as supportEmailService — never
 * throws, so a route never breaks on an email outage. Callers fire these
 * with `void sendX(...).catch(...)`.
 */

import { Resend } from 'resend'
import { maskEmail } from '@/lib/logger'

const SUPPORT_EMAIL = process.env.SUPPORT_ADMIN_EMAIL || 'contact@earn4insights.com'

let resend: Resend | null = null
function getResendClient(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'
}

function from(): string {
  return process.env.EMAIL_FROM || 'security@earn4insights.com'
}

type SendResult = { success: boolean; error?: string }

async function send(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[2fa-email] RESEND_API_KEY not set — skipping "${opts.subject}"`)
    return { success: false, error: 'API key not configured' }
  }
  const client = getResendClient()
  if (!client) return { success: false, error: 'Resend client not initialised' }
  try {
    const { error } = await client.emails.send({
      from: from(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: SUPPORT_EMAIL,
    })
    if (error) {
      console.error(`[2fa-email] send failed to ${maskEmail(opts.to)}:`, error)
      return { success: false, error: String(error) }
    }
    return { success: true }
  } catch (err) {
    console.error(`[2fa-email] send threw for ${maskEmail(opts.to)}:`, err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f6f7fb; margin: 0; padding: 24px; color: #1f2937; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
  .header { padding: 20px 24px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; font-weight: 600; font-size: 16px; }
  .body { padding: 24px; line-height: 1.6; font-size: 14px; }
  .warn { background: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 6px; margin: 14px 0; font-size: 13px; color: #92400e; }
  .button { display: inline-block; padding: 10px 18px; background: #4f46e5; color: #fff !important; text-decoration: none; border-radius: 6px; margin-top: 8px; font-weight: 500; }
  .footer { padding: 16px 24px; font-size: 12px; color: #6b7280; text-align: center; }
</style></head>
<body><div class="card">
  <div class="header">${title}</div>
  <div class="body">${body}</div>
  <div class="footer">Earn4Insights — account security</div>
</div></body></html>`
}

function notYouHtml(): string {
  return `<div class="warn">If this wasn't you, your account may be at risk — change your password
    immediately and contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</div>`
}

const notYouText = `If this wasn't you, change your password immediately and contact ${SUPPORT_EMAIL}.`

// ════════════════════════════════════════════════════════════════
// 1. 2FA enabled
// ════════════════════════════════════════════════════════════════
export async function sendTwoFactorEnabledEmail(
  to: string,
  userName: string | null,
): Promise<SendResult> {
  const subject = 'Two-factor authentication enabled'
  const body = `
    <p>Hi ${escapeHtml(userName || 'there')},</p>
    <p>Two-factor authentication was just <strong>enabled</strong> on your Earn4Insights
      account. Signing in on a new device will now require a code from your
      authenticator app.</p>
    <p>Keep your recovery codes somewhere safe — they are the only way back in if you
      lose your authenticator.</p>
    ${notYouHtml()}`
  const text = `Hi ${userName || 'there'},

Two-factor authentication was enabled on your Earn4Insights account.
Signing in on a new device now requires a code from your authenticator app.

${notYouText}`
  return send({ to, subject, html: emailShell('2FA enabled', body), text })
}

// ════════════════════════════════════════════════════════════════
// 2. 2FA disabled
// ════════════════════════════════════════════════════════════════
export async function sendTwoFactorDisabledEmail(
  to: string,
  userName: string | null,
): Promise<SendResult> {
  const subject = 'Two-factor authentication disabled'
  const body = `
    <p>Hi ${escapeHtml(userName || 'there')},</p>
    <p>Two-factor authentication was just <strong>disabled</strong> on your Earn4Insights
      account. Your account is now protected by your password only, and all trusted
      devices have been removed.</p>
    <p>You can re-enable it any time from Settings → Security.</p>
    <p><a class="button" href="${appUrl()}/dashboard/settings">Open settings</a></p>
    ${notYouHtml()}`
  const text = `Hi ${userName || 'there'},

Two-factor authentication was disabled on your Earn4Insights account.
Your account is now protected by your password only.

Re-enable it: ${appUrl()}/dashboard/settings

${notYouText}`
  return send({ to, subject, html: emailShell('2FA disabled', body), text })
}

// ════════════════════════════════════════════════════════════════
// 3. Recovery code used
// ════════════════════════════════════════════════════════════════
export async function sendRecoveryCodeUsedEmail(
  to: string,
  userName: string | null,
  remaining: number,
): Promise<SendResult> {
  const subject = 'A recovery code was used to sign in'
  const low = remaining <= 3
  const body = `
    <p>Hi ${escapeHtml(userName || 'there')},</p>
    <p>One of your two-factor <strong>recovery codes</strong> was just used to sign in to
      your Earn4Insights account. Each recovery code works only once.</p>
    <p>You have <strong>${remaining}</strong> recovery code${remaining === 1 ? '' : 's'} left.</p>
    ${
      low
        ? `<div class="warn">You're running low on recovery codes. Generate a fresh set from
            Settings → Security so you don't get locked out.</div>`
        : ''
    }
    <p><a class="button" href="${appUrl()}/dashboard/settings">Manage 2FA</a></p>
    ${notYouHtml()}`
  const text = `Hi ${userName || 'there'},

A two-factor recovery code was used to sign in to your Earn4Insights account.
You have ${remaining} recovery code(s) left.${low ? '\n\nYou are running low — generate a fresh set in Settings -> Security.' : ''}

Manage 2FA: ${appUrl()}/dashboard/settings

${notYouText}`
  return send({ to, subject, html: emailShell('Recovery code used', body), text })
}

// ════════════════════════════════════════════════════════════════
// 4. New device trusted
// ════════════════════════════════════════════════════════════════
export async function sendNewDeviceTrustedEmail(
  to: string,
  userName: string | null,
  deviceName: string,
): Promise<SendResult> {
  const subject = 'A new device was trusted on your account'
  const body = `
    <p>Hi ${escapeHtml(userName || 'there')},</p>
    <p><strong>${escapeHtml(deviceName)}</strong> was just added as a trusted device. It
      will skip the two-factor challenge when signing in for the next 30 days.</p>
    <p>You can review and remove trusted devices any time from Settings → Security.</p>
    <p><a class="button" href="${appUrl()}/dashboard/settings">Manage trusted devices</a></p>
    ${notYouHtml()}`
  const text = `Hi ${userName || 'there'},

"${deviceName}" was added as a trusted device on your Earn4Insights account.
It will skip the 2FA challenge for the next 30 days.

Manage trusted devices: ${appUrl()}/dashboard/settings

${notYouText}`
  return send({ to, subject, html: emailShell('New device trusted', body), text })
}

// ════════════════════════════════════════════════════════════════
// 5. Account locked — too many failed challenges
// ════════════════════════════════════════════════════════════════
export async function sendTwoFactorLockoutEmail(
  to: string,
  userName: string | null,
): Promise<SendResult> {
  const subject = 'Too many 2FA attempts — sign-in temporarily locked'
  const body = `
    <p>Hi ${escapeHtml(userName || 'there')},</p>
    <p>There have been several incorrect two-factor codes on your Earn4Insights account,
      so sign-in has been <strong>temporarily locked for 15 minutes</strong>.</p>
    <p>If this was you, just wait 15 minutes and try again with a fresh code from your
      authenticator app, or use a recovery code.</p>
    ${notYouHtml()}`
  const text = `Hi ${userName || 'there'},

Several incorrect two-factor codes were entered on your Earn4Insights account.
Sign-in is temporarily locked for 15 minutes.

If this was you, wait 15 minutes and try again with a fresh code.

${notYouText}`
  return send({ to, subject, html: emailShell('Sign-in temporarily locked', body), text })
}
