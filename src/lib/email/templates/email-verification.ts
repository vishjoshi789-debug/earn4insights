/**
 * Email verification — branded HTML email template (EV.1).
 *
 * Mirrors the existing welcomeNotifications + forgot-password styles
 * so users get a consistent visual identity across the auth lifecycle.
 *
 * Used by emailVerificationService.sendVerificationEmail at:
 *   - Signup (auto-sent once after createUser)
 *   - Resend endpoint POST /api/auth/resend-verification
 *
 * Mobile responsive, inlined styles (Gmail / Apple Mail / Outlook
 * compatible — no external stylesheets).
 */

export function buildVerificationEmailHTML(params: {
  firstName: string
  verifyUrl: string
}): string {
  const { firstName, verifyUrl } = params

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email for Earn4Insights</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:32px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Earn4Insights</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">The Intelligence Operating System for Brands, Consumers and Influencers</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <h2 style="margin:0 0 14px;color:#0f172a;font-size:20px;">Verify your email address</h2>

      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi ${escapeHtml(firstName)},
      </p>

      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 22px;">
        Tap the button below to verify your email. This unlocks payments,
        campaign applications, and other features that need a verified
        identity.
      </p>

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
          Verify Email
        </a>
      </div>

      <!-- Plain URL fallback -->
      <p style="color:#64748b;font-size:13px;margin:18px 0 6px;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 20px;">
        <a href="${verifyUrl}" style="color:#2563eb;font-size:13px;word-break:break-all;">${verifyUrl}</a>
      </p>

      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

      <p style="color:#64748b;font-size:13px;margin:0 0 8px;">
        This link expires in <strong>24 hours</strong>. You can request a
        new one anytime from your account settings.
      </p>

      <p style="color:#94a3b8;font-size:12px;margin:14px 0 0;">
        Didn't sign up for Earn4Insights? You can safely ignore this email
        &mdash; the account won't be activated without this verification.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:18px;color:#94a3b8;font-size:11px;">
      <p style="margin:0;">© Earn4Insights. Hyper-personalised intelligence for India and beyond.</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Minimal HTML escape — names from `users.name` could theoretically
 * contain raw user-controlled HTML. Escape only the 5 critical chars.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const VERIFICATION_EMAIL_SUBJECT = 'Verify your email for Earn4Insights'
