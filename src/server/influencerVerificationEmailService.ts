import 'server-only'

import { Resend } from 'resend'

import {
  buildVerificationAutoApprovedHTML,
  buildVerificationUnderReviewHTML,
  buildVerificationAdminAlertHTML,
  buildVerificationManualApprovedHTML,
  buildVerificationManualRejectedHTML,
  buildVerificationNeedsInfoHTML,
  VERIFICATION_AUTO_APPROVED_SUBJECT,
  VERIFICATION_UNDER_REVIEW_SUBJECT,
  VERIFICATION_ADMIN_ALERT_SUBJECT,
  VERIFICATION_MANUAL_APPROVED_SUBJECT,
  VERIFICATION_MANUAL_REJECTED_SUBJECT,
  VERIFICATION_NEEDS_INFO_SUBJECT,
} from '@/lib/email/templates/influencer-verification'
import { maskEmail } from '@/lib/logger'

/**
 * A9.2 — Verification email sender.
 *
 * Thin Resend wrapper. Fire-and-forget — callers wrap in try/catch or
 * `.catch(log)` so a Resend hiccup never breaks the route's primary
 * action (the DB writes are the source of truth; the email is a
 * notification).
 *
 * Admin alerts go to `SUPPORT_ADMIN_EMAIL` (default
 * `contact@earn4insights.com`) — single destination for low-volume
 * verification queue. Compare with support tickets which fan out to
 * ALL admins via `getAdminUserIds()` (5-min cache); verification is
 * low-enough volume to not need that pattern.
 */

let resendClient: Resend | null = null
function getResend(): Resend | null {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

function getAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000'
  )
}

function getSupportAdminEmail(): string {
  return process.env.SUPPORT_ADMIN_EMAIL || 'contact@earn4insights.com'
}

function firstNameOf(name: string | null | undefined): string {
  return (name?.split(' ')[0] ?? '').trim() || 'there'
}

async function send(opts: {
  to: string
  subject: string
  html: string
  contextTag: string
}): Promise<void> {
  const resend = getResend()
  if (!resend) {
    console.warn(`[VerificationEmail/${opts.contextTag}] Resend not configured — skipping send to`, maskEmail(opts.to))
    return
  }
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Earn4Insights <notifications@earn4insights.com>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    })
    if (error) {
      console.error(`[VerificationEmail/${opts.contextTag}] Resend error:`, error)
    }
  } catch (err) {
    console.error(`[VerificationEmail/${opts.contextTag}] Send failed:`, err)
  }
}

// ── User-facing senders ──────────────────────────────────────────────

export async function sendAutoApprovedEmail(params: {
  email: string
  name: string | null
}): Promise<void> {
  return send({
    to: params.email,
    subject: VERIFICATION_AUTO_APPROVED_SUBJECT,
    html: buildVerificationAutoApprovedHTML({
      firstName: firstNameOf(params.name),
      dashboardUrl: `${getAppBaseUrl()}/dashboard`,
    }),
    contextTag: 'auto_approved',
  })
}

export async function sendUnderReviewEmail(params: {
  email: string
  name: string | null
}): Promise<void> {
  return send({
    to: params.email,
    subject: VERIFICATION_UNDER_REVIEW_SUBJECT,
    html: buildVerificationUnderReviewHTML({
      firstName: firstNameOf(params.name),
      statusUrl: `${getAppBaseUrl()}/dashboard/influencer/verification`,
    }),
    contextTag: 'under_review',
  })
}

export async function sendManualApprovedEmail(params: {
  email: string
  name: string | null
  reviewerNotes: string | null
}): Promise<void> {
  return send({
    to: params.email,
    subject: VERIFICATION_MANUAL_APPROVED_SUBJECT,
    html: buildVerificationManualApprovedHTML({
      firstName: firstNameOf(params.name),
      dashboardUrl: `${getAppBaseUrl()}/dashboard`,
      reviewerNotes: params.reviewerNotes,
    }),
    contextTag: 'manual_approved',
  })
}

export async function sendManualRejectedEmail(params: {
  email: string
  name: string | null
  reviewerNotes: string
  eligibleToReapplyAt: Date
}): Promise<void> {
  return send({
    to: params.email,
    subject: VERIFICATION_MANUAL_REJECTED_SUBJECT,
    html: buildVerificationManualRejectedHTML({
      firstName: firstNameOf(params.name),
      reviewerNotes: params.reviewerNotes,
      eligibleToReapplyAt: params.eligibleToReapplyAt,
      statusUrl: `${getAppBaseUrl()}/dashboard/influencer/verification`,
    }),
    contextTag: 'manual_rejected',
  })
}

export async function sendNeedsInfoEmail(params: {
  email: string
  name: string | null
  reviewerNotes: string
}): Promise<void> {
  return send({
    to: params.email,
    subject: VERIFICATION_NEEDS_INFO_SUBJECT,
    html: buildVerificationNeedsInfoHTML({
      firstName: firstNameOf(params.name),
      reviewerNotes: params.reviewerNotes,
      verificationUrl: `${getAppBaseUrl()}/dashboard/influencer/verification`,
    }),
    contextTag: 'needs_info',
  })
}

// ── Admin-facing sender ──────────────────────────────────────────────

export async function sendAdminAlertEmail(params: {
  influencerName: string
  influencerEmail: string
  totalFollowers: number
  reason: string
}): Promise<void> {
  return send({
    to: getSupportAdminEmail(),
    subject: VERIFICATION_ADMIN_ALERT_SUBJECT,
    html: buildVerificationAdminAlertHTML({
      influencerName: params.influencerName,
      influencerEmail: params.influencerEmail,
      totalFollowers: params.totalFollowers,
      reason: params.reason,
      queueUrl: `${getAppBaseUrl()}/admin/verification-requests`,
    }),
    contextTag: 'admin_alert',
  })
}
