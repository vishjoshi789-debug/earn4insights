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
