import { queueNotification } from '@/server/notificationService'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'

/**
 * Notify consumer that they earned points for feedback.
 * Queued via notificationService (respects preferences + quiet hours).
 */
export async function notifyPointsEarned(params: {
  userId: string
  points: number
  source: string
  productName?: string
}) {
  const { userId, points, source, productName } = params

  const sourceLabel: Record<string, string> = {
    feedback_submit: 'feedback',
    survey_complete: 'survey',
    community_post: 'community post',
    community_reply: 'community reply',
  }

  const activity = sourceLabel[source] || source
  const productRef = productName ? ` on "${productName}"` : ''

  try {
    await queueNotification({
      userId,
      channel: 'email',
      type: 'points_earned',
      subject: `🎉 +${points} points earned for your ${activity}!`,
      body: generatePointsEarnedHTML(points, activity, productRef),
      priority: 7, // lower priority than alerts
    })
  } catch (err) {
    console.error('[ConsumerNotify] Failed to queue points notification:', err)
  }
}

/**
 * Notify consumer about a new product they might be interested in.
 */
export async function notifyNewProductRelevant(params: {
  userId: string
  productName: string
  productId: string
  brandName?: string
  category?: string
}) {
  const { userId, productName, productId, brandName, category } = params

  try {
    await queueNotification({
      userId,
      channel: 'email',
      type: 'new_product_relevant',
      subject: `🆕 New product you might like: ${productName}`,
      body: generateNewProductHTML(productName, productId, brandName, category),
      priority: 6,
    })
  } catch (err) {
    console.error('[ConsumerNotify] Failed to queue new product notification:', err)
  }
}

/**
 * Notify consumer when a product they've watchlisted gets updated.
 */
export async function notifyWatchlistUpdate(params: {
  userId: string
  productName: string
  productId: string
  updateType: 'new_feedback' | 'ranking_change' | 'price_change'
  details: string
}) {
  const { userId, productName, productId, updateType, details } = params

  const subjects: Record<string, string> = {
    new_feedback: `📝 New feedback on "${productName}" (watchlist)`,
    ranking_change: `📊 "${productName}" ranking changed (watchlist)`,
    price_change: `💰 "${productName}" price update (watchlist)`,
  }

  try {
    await queueNotification({
      userId,
      channel: 'email',
      type: `watchlist_${updateType}`,
      subject: subjects[updateType] || `Update on "${productName}"`,
      body: generateWatchlistUpdateHTML(productName, productId, updateType, details),
      priority: 4,
    })
  } catch (err) {
    console.error('[ConsumerNotify] Failed to queue watchlist notification:', err)
  }
}

// ── Email HTML Templates ─────────────────────────────────────────

function generatePointsEarnedHTML(points: number, activity: string, productRef: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border-radius:12px;padding:30px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:48px;margin-bottom:16px;">🎉</div>
      <h2 style="margin:0 0 8px;color:#1e293b;">+${points} Points Earned!</h2>
      <p style="color:#64748b;margin:0 0 20px;font-size:15px;">
        Thanks for your ${activity}${productRef}. Your points have been added to your balance.
      </p>
      <a href="${APP_URL}/dashboard" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        View Balance →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin:20px 0 0;">
        Keep sharing feedback to earn more points!
      </p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px 0 0;">
      Earn4Insights · <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage preferences</a>
    </p>
  </div>
</body>
</html>`
}

function generateNewProductHTML(productName: string, productId: string, brandName?: string, category?: string): string {
  const brandRef = brandName ? ` by <strong>${brandName}</strong>` : ''
  const categoryRef = category ? ` in ${category}` : ''

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:36px;margin-bottom:12px;">🆕</div>
      <h2 style="margin:0 0 8px;color:#1e293b;">New Product Just Launched!</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 16px;">
        <strong>${productName}</strong>${brandRef}${categoryRef} — might be relevant to you based on your interests.
      </p>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
        Be the first to share your feedback and earn <strong>25 points</strong>!
      </p>
      <a href="${APP_URL}/dashboard/products/${productId}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        Check It Out →
      </a>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px 0 0;">
      Earn4Insights · <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage preferences</a>
    </p>
  </div>
</body>
</html>`
}

function generateWatchlistUpdateHTML(productName: string, productId: string, updateType: string, details: string): string {
  const icons: Record<string, string> = {
    new_feedback: '📝',
    ranking_change: '📊',
    price_change: '💰',
  }
  const icon = icons[updateType] || '🔔'

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:20px;">
    <div style="background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <div style="font-size:36px;margin-bottom:12px;">${icon}</div>
      <h2 style="margin:0 0 8px;color:#1e293b;">Watchlist Update</h2>
      <p style="color:#475569;font-size:15px;margin:0 0 8px;">
        <strong>${productName}</strong>
      </p>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
        ${details}
      </p>
      <a href="${APP_URL}/dashboard/products/${productId}" style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
        View Product →
      </a>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:16px 0 0;">
      Earn4Insights · <a href="${APP_URL}/dashboard/settings" style="color:#94a3b8;">Manage preferences</a>
    </p>
  </div>
</body>
</html>`
}
