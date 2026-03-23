import { Resend } from 'resend'
import { sendWhatsAppAlertMessage } from '@/server/whatsappNotifications'

let resend: Resend | null = null

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

// ── Welcome Email ────────────────────────────────────────────────

export async function sendWelcomeEmail(params: {
  email: string
  name: string
  role: 'brand' | 'consumer'
}) {
  const client = getResendClient()
  if (!client) {
    console.warn('[Welcome] Resend not configured — skipping welcome email')
    return { success: false, error: 'Resend not configured' }
  }

  const { email, name, role } = params
  const firstName = name.split(' ')[0]

  try {
    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'welcome@earn4insights.com',
      to: email,
      subject: `🎉 Welcome to Earn4Insights, ${firstName}!`,
      html: role === 'brand'
        ? generateBrandWelcomeHTML(firstName, email)
        : generateConsumerWelcomeHTML(firstName, email),
    })

    if (error) {
      console.error('[Welcome] Email send failed:', error)
      return { success: false, error }
    }

    console.log(`[Welcome] Email sent to ${email} (${role})`)
    return { success: true, data }
  } catch (error) {
    console.error('[Welcome] Email error:', error)
    return { success: false, error }
  }
}

// ── Welcome WhatsApp ─────────────────────────────────────────────

export async function sendWelcomeWhatsApp(params: {
  phoneNumber: string
  name: string
  role: 'brand' | 'consumer'
}) {
  const { phoneNumber, name, role } = params
  const firstName = name.split(' ')[0]

  const body = role === 'brand'
    ? [
        `Welcome aboard, ${firstName}! Your brand dashboard is ready.`,
        '',
        '✅ *Quick Start:*',
        '1️⃣ Add your products to track feedback',
        '2️⃣ View real consumer sentiment & rankings',
        '3️⃣ Create surveys to gather targeted insights',
        '',
        `🔗 Go to Dashboard: ${APP_URL}/dashboard`,
      ].join('\n')
    : [
        `Welcome aboard, ${firstName}! Start earning rewards for your opinions.`,
        '',
        '✅ *Quick Start:*',
        '1️⃣ Browse products and share honest feedback',
        '2️⃣ Earn points for every review & survey',
        '3️⃣ Redeem points for real rewards',
        '',
        `🔗 Explore Products: ${APP_URL}/dashboard/products`,
      ].join('\n')

  return sendWhatsAppAlertMessage({
    phoneNumber,
    title: 'Welcome to Earn4Insights! 🎉',
    body,
    alertType: 'welcome',
  })
}

// ── Fire-and-forget wrapper (non-blocking) ───────────────────────

export function sendWelcomeNotifications(params: {
  email: string
  name: string
  role: 'brand' | 'consumer'
  phoneNumber?: string
}) {
  const { email, name, role, phoneNumber } = params

  // Send email (fire-and-forget — don't block signup)
  sendWelcomeEmail({ email, name, role }).catch((err) =>
    console.error('[Welcome] Email failed silently:', err)
  )

  // Send WhatsApp if phone number provided
  if (phoneNumber) {
    sendWelcomeWhatsApp({ phoneNumber, name, role }).catch((err) =>
      console.error('[Welcome] WhatsApp failed silently:', err)
    )
  }
}

// ── Email Templates ──────────────────────────────────────────────

function generateConsumerWelcomeHTML(firstName: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px 12px 0 0;padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">Welcome to Earn4Insights! 🎉</h1>
      <p style="color:#e0e7ff;margin:10px 0 0;font-size:16px;">Hey ${firstName}, your voice matters — and now it pays.</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 20px;">
        You've just joined a community where <strong>real feedback drives real rewards</strong>. Here's everything you need to get started:
      </p>

      <!-- Step Cards -->
      <div style="margin:24px 0;">
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
          <span style="font-size:24px;margin-right:12px;">1️⃣</span>
          <div>
            <strong style="color:#15803d;">Browse & Review Products</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Explore products and share your honest experience. Each review earns you points.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
          <span style="font-size:24px;margin-right:12px;">2️⃣</span>
          <div>
            <strong style="color:#1d4ed8;">Take Surveys & Earn Points</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Complete quick surveys from brands. Each response earns up to <strong>50 points</strong>.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#fdf4ff;border-radius:8px;border-left:4px solid #a855f7;">
          <span style="font-size:24px;margin-right:12px;">3️⃣</span>
          <div>
            <strong style="color:#7e22ce;">Redeem Your Rewards</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Cash out your points for real rewards. The more you contribute, the more you earn.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;padding:16px;background:#fff7ed;border-radius:8px;border-left:4px solid #f97316;">
          <span style="font-size:24px;margin-right:12px;">4️⃣</span>
          <div>
            <strong style="color:#c2410c;">Build Your Watchlist</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Follow products you care about and get personalized recommendations.</p>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${APP_URL}/dashboard" style="background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
          Start Exploring →
        </a>
      </div>

      <!-- Key Info Box -->
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 10px;color:#334155;font-size:15px;">📌 Important Details</h3>
        <ul style="margin:0;padding:0 0 0 18px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Your account email: <strong>${email}</strong></li>
          <li>All feedback is <strong>anonymous to brands</strong> — your privacy is protected</li>
          <li>Points never expire as long as your account is active</li>
          <li>You can manage notification preferences in <a href="${APP_URL}/dashboard/settings" style="color:#6366f1;">Settings</a></li>
        </ul>
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:24px 0 0;">
        Questions? Just reply to this email — we're here to help.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Earn4Insights — Real Voices. Measurable Intelligence.</p>
      <p style="margin:4px 0 0;">
        <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function generateBrandWelcomeHTML(firstName: string, email: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:40px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">Welcome to Earn4Insights! 🚀</h1>
      <p style="color:#94a3b8;margin:10px 0 0;font-size:16px;">Hey ${firstName}, your brand intelligence hub is ready.</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 20px;">
        You now have access to <strong>real consumer insights powered by authentic feedback</strong>. Here's how to make the most of your dashboard:
      </p>

      <!-- Step Cards -->
      <div style="margin:24px 0;">
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
          <span style="font-size:24px;margin-right:12px;">1️⃣</span>
          <div>
            <strong style="color:#1d4ed8;">Add Your Products</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">List your products to start collecting real feedback from verified consumers.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
          <span style="font-size:24px;margin-right:12px;">2️⃣</span>
          <div>
            <strong style="color:#15803d;">Track Rankings & Sentiment</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">See where your products rank and monitor sentiment trends in real time.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#fdf4ff;border-radius:8px;border-left:4px solid #a855f7;">
          <span style="font-size:24px;margin-right:12px;">3️⃣</span>
          <div>
            <strong style="color:#7e22ce;">Create Surveys</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Launch targeted surveys to gather deep insights — NPS, CSAT, or custom questions.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;padding:16px;background:#fff7ed;border-radius:8px;border-left:4px solid #f97316;">
          <span style="font-size:24px;margin-right:12px;">4️⃣</span>
          <div>
            <strong style="color:#c2410c;">Analyze & Act</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Use category intelligence and analytics to make data-driven product decisions.</p>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${APP_URL}/dashboard" style="background:#0f172a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
          Open Your Dashboard →
        </a>
      </div>

      <!-- Key Info Box -->
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 10px;color:#334155;font-size:15px;">📌 Important Details</h3>
        <ul style="margin:0;padding:0 0 0 18px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Your account email: <strong>${email}</strong></li>
          <li>All consumer feedback is <strong>anonymized</strong> — you see insights, not identities</li>
          <li>Rankings update <strong>weekly</strong> based on aggregated consumer feedback</li>
          <li>Set up alerts in <a href="${APP_URL}/dashboard/settings" style="color:#6366f1;">Settings</a> to get notified of new feedback &amp; ranking changes</li>
          <li>Need help? Check our <a href="${APP_URL}/dashboard" style="color:#6366f1;">Dashboard Guide</a> or reply to this email</li>
        </ul>
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:24px 0 0;">
        Questions? Just reply to this email — our team is here to help you succeed.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Earn4Insights — Real Voices. Measurable Intelligence.</p>
      <p style="margin:4px 0 0;">
        <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
