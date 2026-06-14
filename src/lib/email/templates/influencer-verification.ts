/**
 * A9.2 — Influencer verification email templates.
 *
 * Six branded HTML templates covering every state transition of the
 * verification request lifecycle. Visual identity matches
 * `email-verification.ts` (EV.1) and `welcomeNotifications` so users see
 * one consistent brand voice across auth + verification flows.
 *
 * Templates:
 *   1. autoApproved        — Tier 1 auto-approve at submission
 *   2. underManualReview   — Tier 2 — your request is in our queue
 *   3. adminAlert          — sent to SUPPORT_ADMIN_EMAIL when a new
 *                            manual_review row lands (also used for
 *                            needs_info → resubmitted flow)
 *   4. manualApproved      — admin approved a manual_review request
 *   5. manualRejected      — admin rejected; includes notes + cooldown date
 *   6. needsInfo           — admin asked for more info; user can resubmit
 *                            without cooldown
 *
 * Mobile responsive, inlined styles. Gmail / Apple Mail / Outlook safe.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function shell(opts: {
  preheader: string
  heading: string
  bodyHtml: string
}): string {
  const { preheader, heading, bodyHtml } = opts
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <span style="display:none !important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:32px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Earn4Insights</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">The Intelligence Operating System for Brands, Consumers and Influencers</p>
    </div>
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="margin:0 0 14px;color:#0f172a;font-size:20px;">${escapeHtml(heading)}</h2>
      ${bodyHtml}
    </div>
    <div style="text-align:center;padding:18px;color:#94a3b8;font-size:11px;">
      <p style="margin:0;">© Earn4Insights. Hyper-personalised intelligence for India and beyond.</p>
    </div>
  </div>
</body>
</html>`
}

function ctaButton(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">${escapeHtml(label)}</a>
    </div>`
}

// ── 1. Tier 1 auto-approved ─────────────────────────────────────────

export const VERIFICATION_AUTO_APPROVED_SUBJECT = "You're a verified influencer 🎉"

export function buildVerificationAutoApprovedHTML(params: {
  firstName: string
  dashboardUrl: string
}): string {
  const { firstName, dashboardUrl } = params
  return shell({
    preheader: "Your verification request was auto-approved. The verified badge is live on your profile.",
    heading: "You're verified!",
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Great news — your verification request just passed every automatic check.
        Your profile now shows the verified badge across the marketplace and
        anywhere brands see your application.
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 8px;">
        What this unlocks:
      </p>
      <ul style="color:#334155;font-size:14px;line-height:1.7;margin:0 0 18px;padding-left:20px;">
        <li>A trust badge on every campaign application</li>
        <li>Higher visibility in brand-side influencer search</li>
        <li>Eligibility for premium campaigns reserved for verified creators</li>
      </ul>
      ${ctaButton(dashboardUrl, 'Go to my dashboard')}
      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        Keep your profile up to date — verification can be re-reviewed if
        details change significantly.
      </p>
    `,
  })
}

// ── 2. Tier 2 — under manual review ─────────────────────────────────

export const VERIFICATION_UNDER_REVIEW_SUBJECT = 'Your verification request is being reviewed'

export function buildVerificationUnderReviewHTML(params: {
  firstName: string
  statusUrl: string
}): string {
  const { firstName, statusUrl } = params
  return shell({
    preheader: "Our team will review your verification request within a few business days.",
    heading: 'Your request is in our review queue',
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Thanks for submitting your verification request. A few details put
        your application into the manual-review queue, where our team takes
        a closer look before deciding.
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        We aim to review every request within <strong>a few business days</strong>.
        You'll get another email the moment the decision lands — no need to
        check back in the meantime.
      </p>
      ${ctaButton(statusUrl, 'See request status')}
      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        While you wait, you can keep building your profile, applying for
        public campaigns, and engaging with the community. Verification just
        unlocks the trust badge and premium-campaign eligibility.
      </p>
    `,
  })
}

// ── 3. Admin alert (sent to SUPPORT_ADMIN_EMAIL) ────────────────────

export const VERIFICATION_ADMIN_ALERT_SUBJECT = '[Admin] New influencer verification needs review'

export function buildVerificationAdminAlertHTML(params: {
  influencerName: string
  influencerEmail: string
  totalFollowers: number
  reason: string
  queueUrl: string
}): string {
  const { influencerName, influencerEmail, totalFollowers, reason, queueUrl } = params
  return shell({
    preheader: `${escapeHtml(influencerName)} (${totalFollowers.toLocaleString()} followers) submitted a manual-review verification request.`,
    heading: 'New verification request',
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        A new influencer verification request landed in the admin queue and
        needs your decision.
      </p>
      <table cellspacing="0" cellpadding="6" style="border-collapse:collapse;margin:0 0 18px;font-size:14px;color:#334155;">
        <tr><td style="color:#64748b;">Influencer</td><td><strong>${escapeHtml(influencerName)}</strong></td></tr>
        <tr><td style="color:#64748b;">Email</td><td>${escapeHtml(influencerEmail)}</td></tr>
        <tr><td style="color:#64748b;">Total followers</td><td>${totalFollowers.toLocaleString()}</td></tr>
        <tr><td style="color:#64748b;vertical-align:top;">Evaluator note</td><td>${escapeHtml(reason)}</td></tr>
      </table>
      ${ctaButton(queueUrl, 'Open the admin queue')}
      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        The queue page shows the full threshold-check breakdown, application
        message, brand contact notes, and portfolio links.
      </p>
    `,
  })
}

// ── 4. Manual approved ──────────────────────────────────────────────

export const VERIFICATION_MANUAL_APPROVED_SUBJECT = "You're verified — welcome aboard!"

export function buildVerificationManualApprovedHTML(params: {
  firstName: string
  dashboardUrl: string
  reviewerNotes: string | null
}): string {
  const { firstName, dashboardUrl, reviewerNotes } = params
  const notesBlock = reviewerNotes
    ? `<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:4px;margin:0 0 20px;">
         <p style="color:#166534;font-size:13px;font-weight:600;margin:0 0 4px;">Note from our team</p>
         <p style="color:#15803d;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(reviewerNotes)}</p>
       </div>`
    : ''
  return shell({
    preheader: 'Our team approved your verification request. You are now a verified influencer.',
    heading: 'You’re a verified influencer',
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 18px;">
        Our team reviewed your verification request and approved it.
        Your verified badge is live across the marketplace and on every
        campaign application brands see from you.
      </p>
      ${notesBlock}
      ${ctaButton(dashboardUrl, 'Go to my dashboard')}
    `,
  })
}

// ── 5. Manual rejected (with cooldown) ──────────────────────────────

export const VERIFICATION_MANUAL_REJECTED_SUBJECT = 'Update on your verification request'

export function buildVerificationManualRejectedHTML(params: {
  firstName: string
  reviewerNotes: string
  eligibleToReapplyAt: Date
  statusUrl: string
}): string {
  const { firstName, reviewerNotes, eligibleToReapplyAt, statusUrl } = params
  const reapplyDate = eligibleToReapplyAt.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  return shell({
    preheader: `Verification was not approved this time. You can re-apply on ${reapplyDate}.`,
    heading: 'Verification not approved this time',
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Thanks for submitting your verification request. After review, our
        team decided not to approve it at this time.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px 16px;border-radius:4px;margin:0 0 20px;">
        <p style="color:#991b1b;font-size:13px;font-weight:600;margin:0 0 4px;">Reason from our team</p>
        <p style="color:#b91c1c;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(reviewerNotes)}</p>
      </div>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 22px;">
        You can submit a fresh request on or after <strong>${escapeHtml(reapplyDate)}</strong>.
        In the meantime, the items in the note above are the best places to
        focus before re-applying.
      </p>
      ${ctaButton(statusUrl, 'See full status')}
      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        Verification isn't required to use the platform — you can still apply
        for any campaign that doesn't restrict to verified-only creators.
      </p>
    `,
  })
}

// ── 6. Needs info ───────────────────────────────────────────────────

export const VERIFICATION_NEEDS_INFO_SUBJECT = 'Quick follow-up on your verification request'

export function buildVerificationNeedsInfoHTML(params: {
  firstName: string
  reviewerNotes: string
  verificationUrl: string
}): string {
  const { firstName, reviewerNotes, verificationUrl } = params
  return shell({
    preheader: 'Our team asked for a small clarification before approving your verification.',
    heading: 'A small clarification, please',
    bodyHtml: `
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Our team had one quick question before finalising your verification
        decision. No cooldown applies — please reply with the requested
        info and we'll re-review right away.
      </p>
      <div style="background:#fffbeb;border-left:4px solid #d97706;padding:14px 16px;border-radius:4px;margin:0 0 20px;">
        <p style="color:#92400e;font-size:13px;font-weight:600;margin:0 0 4px;">Note from our team</p>
        <p style="color:#b45309;font-size:14px;line-height:1.5;margin:0;">${escapeHtml(reviewerNotes)}</p>
      </div>
      ${ctaButton(verificationUrl, 'Update my request')}
      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        Once you re-submit, your request goes straight back to our queue —
        no waiting period.
      </p>
    `,
  })
}
