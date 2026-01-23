import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface RankingEmailData {
  productName: string
  rank: number
  category: string
  previousRank?: number
  score: number
  ownerEmail: string
  ownerName?: string
}

/**
 * Send ranking notification email to product owner
 */
export async function sendRankingNotification(data: RankingEmailData) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ Resend API key not configured, skipping email')
    return { success: false, error: 'API key not configured' }
  }

  try {
    const rankChange = data.previousRank
      ? data.rank - data.previousRank
      : null

    const subject = rankChange && rankChange < 0
      ? `🎉 ${data.productName} moved up to #${data.rank}!`
      : `📊 ${data.productName} is #${data.rank} this week`

    const { data: emailData, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'rankings@brandpulse.com',
      to: data.ownerEmail,
      subject,
      html: generateRankingEmailHTML(data, rankChange),
    })

    if (error) {
      console.error('Failed to send ranking email:', error)
      return { success: false, error }
    }

    console.log(`✅ Ranking email sent to ${data.ownerEmail}`)
    return { success: true, data: emailData }
  } catch (error) {
    console.error('Error sending ranking email:', error)
    return { success: false, error }
  }
}

/**
 * Generate HTML email template for ranking notification
 */
function generateRankingEmailHTML(data: RankingEmailData, rankChange: number | null): string {
  const emoji = data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🏆'
  
  const rankChangeHTML = rankChange !== null ? `
    <div style="margin: 20px 0; padding: 15px; background: ${rankChange < 0 ? '#dcfce7' : rankChange > 0 ? '#fef3c7' : '#f3f4f6'}; border-radius: 8px;">
      <p style="margin: 0; color: ${rankChange < 0 ? '#15803d' : rankChange > 0 ? '#d97706' : '#6b7280'}; font-weight: 600;">
        ${rankChange < 0 ? `↑ Up ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? 's' : ''}!` : 
          rankChange > 0 ? `↓ Down ${rankChange} position${rankChange > 1 ? 's' : ''}` : 
          '→ Position unchanged'}
      </p>
      <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">
        Previous rank: #${data.previousRank}
      </p>
    </div>
  ` : ''

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Ranking Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <!-- Header -->
          <div style="text-align: center; padding: 30px 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">
              ${emoji} Weekly Ranking Update
            </h1>
          </div>

          <!-- Content -->
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 10px;">
              Hi ${data.ownerName || 'there'},
            </p>

            <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
              Great news! Here's how <strong>${data.productName}</strong> performed in this week's rankings:
            </p>

            <!-- Rank Badge -->
            <div style="text-align: center; margin: 30px 0; padding: 30px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px;">
              <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
              <h2 style="margin: 0; font-size: 36px; color: #92400e;">
                Rank #${data.rank}
              </h2>
              <p style="margin: 10px 0 0 0; color: #78350f; font-size: 18px;">
                in ${data.category}
              </p>
            </div>

            ${rankChangeHTML}

            <!-- Score -->
            <div style="margin: 20px 0; padding: 15px; background: #f9fafb; border-radius: 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">Ranking Score</p>
              <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: 700; color: #111827;">
                ${data.score.toFixed(2)}
              </p>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/top-products/${data.category.toLowerCase()}" 
                 style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Full Rankings
              </a>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #9ca3af;">
                Rankings are updated every Monday based on user feedback, NPS scores, and engagement metrics.
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #d1d5db;">
                © ${new Date().getFullYear()} BrandPulse. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Send bulk ranking notifications to all ranked products
 */
export async function sendBulkRankingNotifications(rankings: RankingEmailData[]) {
  const results = await Promise.allSettled(
    rankings.map(data => sendRankingNotification(data))
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`📧 Email notifications: ${successful} sent, ${failed} failed`)

  return {
    total: rankings.length,
    successful,
    failed,
    results,
  }
}
