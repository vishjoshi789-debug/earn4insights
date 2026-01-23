'use server'

import 'server-only'

export type EmailNotification = {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Send email notification
 * 
 * To enable real email sending:
 * 1. Install email provider: npm install resend
 * 2. Add API key to .env: RESEND_API_KEY=your_key
 * 3. Uncomment the Resend implementation below
 */
export async function sendEmail(notification: EmailNotification): Promise<void> {
  // For development: Log to console
  console.log('📧 Email Notification:')
  console.log('To:', notification.to)
  console.log('Subject:', notification.subject)
  console.log('Body:', notification.text)

  // TODO: Implement real email sending
  // Example with Resend:
  /*
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'notifications@yourdomain.com',
    to: notification.to,
    subject: notification.subject,
    html: notification.html,
    text: notification.text,
  })
  */
}

export async function sendSurveyResponseNotification(
  surveyTitle: string,
  surveyId: string,
  productId: string,
  rating?: number,
  textPreview?: string,
  respondentName?: string
): Promise<void> {
  // In production, you'd fetch the product owner's email from the database
  // For now, we'll use an environment variable or skip
  const ownerEmail = process.env.NOTIFICATION_EMAIL
  
  if (!ownerEmail) {
    console.log('ℹ️ No NOTIFICATION_EMAIL configured, skipping email notification')
    return
  }

  const subject = `New Response: ${surveyTitle}`
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .rating { font-size: 32px; font-weight: bold; color: #2563eb; }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Survey Response!</h1>
          </div>
          <div class="content">
            <p><strong>Survey:</strong> ${surveyTitle}</p>
            ${respondentName ? `<p><strong>From:</strong> ${respondentName}</p>` : ''}
            ${rating !== undefined ? `<p><strong>Rating:</strong> <span class="rating">${rating}</span></p>` : ''}
            ${textPreview ? `
              <div style="background: white; padding: 16px; border-left: 4px solid #2563eb; margin: 16px 0;">
                <em>"${textPreview}"</em>
              </div>
            ` : ''}
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/surveys/${surveyId}/responses" class="button">
              View All Responses
            </a>
          </div>
        </div>
      </body>
    </html>
  `
  
  const text = `
New Response to ${surveyTitle}
${respondentName ? `From: ${respondentName}` : ''}
${rating !== undefined ? `Rating: ${rating}` : ''}
${textPreview ? `Feedback: "${textPreview}"` : ''}

View all responses: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/surveys/${surveyId}/responses
  `.trim()

  await sendEmail({
    to: ownerEmail,
    subject,
    html,
    text,
  })
}

/**
 * Send ranking notification to brand
 */
export async function sendBrandRankingNotification(
  productId: string,
  productName: string,
  categoryName: string,
  currentRank: number,
  previousRank: number | null,
  score: number,
  npsScore: number,
  totalResponses: number,
  weekStart: string
): Promise<void> {
  const ownerEmail = process.env.NOTIFICATION_EMAIL
  
  if (!ownerEmail) {
    console.log('ℹ️ No NOTIFICATION_EMAIL configured, skipping ranking notification')
    return
  }

  const isNewEntry = previousRank === null
  const rankImproved = previousRank !== null && currentRank < previousRank
  const rankDeclined = previousRank !== null && currentRank > previousRank

  const subject = isNewEntry 
    ? `🎉 ${productName} is now in Top 10 ${categoryName}!`
    : rankImproved
    ? `📈 ${productName} climbed to #${currentRank} in ${categoryName}!`
    : rankDeclined
    ? `📊 ${productName} ranking update - Now #${currentRank}`
    : `✨ ${productName} maintains #${currentRank} in ${categoryName}`

  const emoji = currentRank === 1 ? '🏆' : currentRank <= 3 ? '🥇' : '⭐'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .rank-badge { font-size: 72px; font-weight: bold; margin: 20px 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .metric { background: white; padding: 16px; margin: 12px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
          .metric-label { color: #6b7280; font-size: 14px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin-top: 20px;
            font-weight: 600;
          }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 10px;">${emoji}</div>
            <h1 style="margin: 0;">Weekly Ranking Update</h1>
            <p style="opacity: 0.9; margin-top: 8px;">${productName}</p>
          </div>
          <div class="content">
            <div class="rank-badge" style="text-align: center; color: #2563eb;">
              #${currentRank}
            </div>
            <p style="text-align: center; font-size: 18px; margin-bottom: 24px;">
              ${isNewEntry ? 'Congratulations! You\'re now in the Top 10!' :
                rankImproved ? `You moved up ${previousRank - currentRank} ${previousRank - currentRank === 1 ? 'spot' : 'spots'}! 📈` :
                rankDeclined ? `You dropped ${currentRank - previousRank} ${currentRank - previousRank === 1 ? 'spot' : 'spots'}.` :
                'You maintained your position! Keep it up! 💪'}
            </p>

            <div class="metric">
              <div>
                <div class="metric-label">Category</div>
                <div style="font-size: 16px; font-weight: 600; color: #111;">${categoryName}</div>
              </div>
            </div>

            <div class="metric">
              <div>
                <div class="metric-label">NPS Score</div>
              </div>
              <div class="metric-value">${npsScore.toFixed(0)}</div>
            </div>

            <div class="metric">
              <div>
                <div class="metric-label">Total Responses</div>
              </div>
              <div class="metric-value">${totalResponses}</div>
            </div>

            <div class="metric">
              <div>
                <div class="metric-label">Ranking Score</div>
              </div>
              <div class="metric-value">${(score * 100).toFixed(0)}</div>
            </div>

            ${previousRank !== null ? `
            <div class="metric">
              <div>
                <div class="metric-label">Previous Rank</div>
              </div>
              <div class="metric-value" style="color: #6b7280;">#${previousRank}</div>
            </div>
            ` : ''}

            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/top-products/${categoryName.replace(/\s+/g, '_')}" class="button">
                View Full Rankings
              </a>
            </div>

            <div class="footer">
              <p>Week of ${new Date(weekStart).toLocaleDateString()}</p>
              <p>Rankings are updated every week based on verified user feedback.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
${emoji} Weekly Ranking Update - ${productName}

You're now ranked #${currentRank} in ${categoryName}!

${isNewEntry ? '🎉 Congratulations! You\'re now in the Top 10!' :
  rankImproved ? `📈 You moved up ${previousRank - currentRank} ${previousRank - currentRank === 1 ? 'spot' : 'spots'}!` :
  rankDeclined ? `You dropped ${currentRank - previousRank} ${currentRank - previousRank === 1 ? 'spot' : 'spots'}.` :
  '💪 You maintained your position! Keep it up!'}

Your Metrics:
- NPS Score: ${npsScore.toFixed(0)}
- Total Responses: ${totalResponses}
- Ranking Score: ${(score * 100).toFixed(0)}
${previousRank !== null ? `- Previous Rank: #${previousRank}` : ''}

View full rankings: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/top-products

Week of ${new Date(weekStart).toLocaleDateString()}
  `.trim()

  await sendEmail({
    to: ownerEmail,
    subject,
    html,
    text,
  })
}

/**
 * Send weekly top products digest to users
 */
export async function sendUserRankingDigest(
  userEmail: string,
  userName: string,
  categories: Array<{
    categoryName: string
    categoryKey: string
    topProducts: Array<{
      rank: number
      productName: string
      npsScore: number
      trendDirection: 'up' | 'down' | 'stable'
    }>
  }>,
  weekStart: string
): Promise<void> {
  const subject = `📊 Your Weekly Top Products Digest`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .category { background: white; padding: 20px; margin: 16px 0; border-radius: 8px; }
          .category-title { font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #111; }
          .product { padding: 12px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 12px; }
          .product:last-child { border-bottom: none; }
          .rank { font-weight: bold; color: #2563eb; font-size: 18px; min-width: 32px; }
          .trend-up { color: #10b981; }
          .trend-down { color: #ef4444; }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin-top: 20px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div style="font-size: 48px; margin-bottom: 10px;">🏆</div>
            <h1 style="margin: 0;">Top Products This Week</h1>
            <p style="opacity: 0.9; margin-top: 8px;">Your personalized digest</p>
          </div>
          <div class="content">
            <p>Hi ${userName}! 👋</p>
            <p>Here are this week's top-rated products in your favorite categories:</p>

            ${categories.map(cat => `
              <div class="category">
                <div class="category-title">${cat.categoryName}</div>
                ${cat.topProducts.map(product => `
                  <div class="product">
                    <div class="rank">#${product.rank}</div>
                    <div style="flex: 1;">
                      <div style="font-weight: 600;">${product.productName}</div>
                      <div style="font-size: 12px; color: #6b7280;">
                        NPS: ${product.npsScore.toFixed(0)}
                      </div>
                    </div>
                    ${product.trendDirection === 'up' ? '<div class="trend-up">↗</div>' : 
                      product.trendDirection === 'down' ? '<div class="trend-down">↘</div>' : 
                      '<div style="color: #6b7280;">→</div>'}
                  </div>
                `).join('')}
              </div>
            `).join('')}

            <div style="text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/top-products" class="button">
                Explore All Rankings
              </a>
            </div>

            <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px;">
              Week of ${new Date(weekStart).toLocaleDateString()}
            </p>
          </div>
        </div>
      </body>
    </html>
  `

  const text = `
🏆 Top Products This Week

Hi ${userName}!

Here are this week's top-rated products in your favorite categories:

${categories.map(cat => `
${cat.categoryName}
${cat.topProducts.map(p => `  #${p.rank} ${p.productName} - NPS: ${p.npsScore.toFixed(0)} ${p.trendDirection === 'up' ? '↗' : p.trendDirection === 'down' ? '↘' : '→'}`).join('\n')}
`).join('\n')}

Explore all rankings: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/top-products

Week of ${new Date(weekStart).toLocaleDateString()}
  `.trim()

  await sendEmail({
    to: userEmail,
    subject,
    html,
    text,
  })
}
