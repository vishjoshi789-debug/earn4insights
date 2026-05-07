import { Resend } from 'resend'

let resend: Resend | null = null

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'

// ── Brand Product-Launched Confirmation ──────────────────────────

export async function sendProductLaunchedEmail(params: {
  brandEmail: string
  brandName: string | null | undefined
  productId: string
  productName: string
}) {
  const client = getResendClient()
  if (!client) {
    console.warn('[ProductLaunched] Resend not configured — skipping email')
    return { success: false, error: 'Resend not configured' }
  }

  const { brandEmail, brandName, productId, productName } = params
  const firstName = (brandName || '').trim().split(' ')[0] || 'there'

  try {
    const { data, error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Earn4Insights <welcome@earn4insights.com>',
      to: brandEmail,
      subject: `🚀 ${productName} is live on Earn4Insights`,
      html: generateProductLaunchedHTML({ firstName, productId, productName }),
    })

    if (error) {
      console.error('[ProductLaunched] Email send failed:', error)
      return { success: false, error }
    }

    console.log(`[ProductLaunched] Email sent to ${brandEmail} for product ${productId}`)
    return { success: true, data }
  } catch (error) {
    console.error('[ProductLaunched] Email error:', error)
    return { success: false, error }
  }
}

function generateProductLaunchedHTML(args: {
  firstName: string
  productId: string
  productName: string
}): string {
  const { firstName, productId, productName } = args
  const productUrl = `${APP_URL}/dashboard/products/${productId}`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:12px 12px 0 0;padding:40px 30px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">🚀</div>
      <h1 style="color:#fff;margin:0;font-size:26px;">Your product is live!</h1>
      <p style="color:#94a3b8;margin:10px 0 0;font-size:16px;">${productName}</p>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:30px;border-radius:0 0 12px 12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 20px;">
        Hi ${firstName}, <strong>${productName}</strong> is now on Earn4Insights and ready to collect real consumer feedback. Here&rsquo;s what to do next:
      </p>

      <!-- Step Cards -->
      <div style="margin:24px 0;">
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
          <span style="font-size:24px;margin-right:12px;">1️⃣</span>
          <div>
            <strong style="color:#1d4ed8;">Configure your product profile</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Add a category, branding, website and details so consumers can identify your product easily.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#f0fdf4;border-radius:8px;border-left:4px solid #22c55e;">
          <span style="font-size:24px;margin-right:12px;">2️⃣</span>
          <div>
            <strong style="color:#15803d;">Create your first survey</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Launch NPS, CSAT or custom surveys targeted at the audience you want to hear from.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px;padding:16px;background:#fdf4ff;border-radius:8px;border-left:4px solid #a855f7;">
          <span style="font-size:24px;margin-right:12px;">3️⃣</span>
          <div>
            <strong style="color:#7e22ce;">Define your Ideal Consumer Profile</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Set weighted criteria so the platform scores every consumer against your ideal target and surfaces the best matches.</p>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;padding:16px;background:#fff7ed;border-radius:8px;border-left:4px solid #f97316;">
          <span style="font-size:24px;margin-right:12px;">4️⃣</span>
          <div>
            <strong style="color:#c2410c;">Watch real consumer feedback come in</strong>
            <p style="margin:4px 0 0;color:#4b5563;font-size:14px;">Open the Feedback Hub to read text, audio and video reviews with AI sentiment analysis as they arrive.</p>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:30px 0;">
        <a href="${productUrl}" style="background:#0f172a;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block;">
          Open Product Dashboard &rarr;
        </a>
      </div>

      <!-- Key Info Box -->
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 10px;color:#334155;font-size:15px;">📌 Good to know</h3>
        <ul style="margin:0;padding:0 0 0 18px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Rankings refresh <strong>weekly</strong> — your product will appear once you have enough feedback</li>
          <li>Smart Alerts can ping you on new feedback, ranking changes and high-match consumer signals — set them up in <a href="${APP_URL}/dashboard/alerts" style="color:#6366f1;">Alerts</a></li>
          <li>Manage notification preferences in <a href="${APP_URL}/dashboard/settings" style="color:#6366f1;">Settings</a></li>
        </ul>
      </div>

      <p style="color:#64748b;font-size:13px;text-align:center;margin:24px 0 0;">
        Questions? Just reply to this email &mdash; our team is here to help.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">
      <p style="margin:0;">Earn4Insights &mdash; The Intelligence Operating System for Brands, Consumers and Influencers</p>
      <p style="margin:4px 0 0;">
        <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
