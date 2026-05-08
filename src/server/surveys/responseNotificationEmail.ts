'use server'

import 'server-only'
import { Resend } from 'resend'

let resend: Resend | null = null
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://earn4insights.com'

/**
 * Send a survey-response notification email to the brand owner.
 * Migrated from src/server/emailService.ts (deprecated console-logger)
 * to use real Resend delivery.
 *
 * Recipient is read from NOTIFICATION_EMAIL env var. If unset, the function
 * is a no-op — survey response submission still succeeds. Errors are logged
 * but never thrown so the caller's response submission flow isn't blocked.
 */
export async function sendSurveyResponseNotification(
  surveyTitle: string,
  surveyId: string,
  productId: string,
  rating?: number,
  textPreview?: string,
  respondentName?: string
): Promise<{ success: boolean; error?: string }> {
  const ownerEmail = process.env.NOTIFICATION_EMAIL
  if (!ownerEmail) {
    console.log('[SurveyResponse] NOTIFICATION_EMAIL not configured, skipping email')
    return { success: false, error: 'NOTIFICATION_EMAIL not set' }
  }

  const client = getResendClient()
  if (!client) {
    console.warn('[SurveyResponse] Resend not configured — skipping email')
    return { success: false, error: 'Resend not configured' }
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
            display: inline-block; background: #2563eb; color: white;
            padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px;
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
            <a href="${APP_URL}/dashboard/surveys/${surveyId}/responses" class="button">
              View All Responses
            </a>
          </div>
        </div>
      </body>
    </html>
  `

  try {
    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Earn4Insights <notifications@earn4insights.com>',
      to: ownerEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[SurveyResponse] Send failed:', error)
      return { success: false, error: String(error) }
    }

    console.log(`[SurveyResponse] Email sent to ${ownerEmail} for survey ${surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('[SurveyResponse] Email error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
