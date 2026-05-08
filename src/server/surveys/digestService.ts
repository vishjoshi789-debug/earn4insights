'use server'

import 'server-only'
import { getSurveyById, getResponsesBySurveyId } from '@/db/repositories/surveyRepository'
import { calculateMultimodalAnalytics } from './analyticsService'
import { Resend } from 'resend'

let resend: Resend | null = null
function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

/**
 * Generate and send a weekly analytics digest email for a survey.
 * This can be triggered by a cron job or manually by admins.
 */
export async function sendSurveyDigestEmail(params: {
  surveyId: string
  recipientEmail: string
  recipientName?: string
  periodDays?: number
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { surveyId, recipientEmail, recipientName, periodDays = 7 } = params

    const survey = await getSurveyById(surveyId)
    if (!survey) {
      return { success: false, error: 'Survey not found' }
    }

    // Calculate analytics for the past N days
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - periodDays)

    const analytics = await calculateMultimodalAnalytics({
      surveyId,
      dateFrom,
    })

    // Build email content
    const subject = `📊 ${survey.title} - Weekly Feedback Digest`
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">📊 Feedback Digest</h1>
        <h2 style="color: #666;">${survey.title}</h2>
        <p style="color: #666;">Period: Last ${periodDays} days</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📈 Overview</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;"><strong>Total Responses:</strong> ${analytics.totalResponses}</li>
            <li style="padding: 8px 0;"><strong>Text Feedback:</strong> ${analytics.modalityMetrics.text} (${((analytics.modalityMetrics.text / analytics.totalResponses) * 100).toFixed(1)}%)</li>
            <li style="padding: 8px 0;"><strong>Audio Feedback:</strong> ${analytics.modalityMetrics.audio} (${((analytics.modalityMetrics.audio / analytics.totalResponses) * 100).toFixed(1)}%)</li>
            <li style="padding: 8px 0;"><strong>Video Feedback:</strong> ${analytics.modalityMetrics.video} (${((analytics.modalityMetrics.video / analytics.totalResponses) * 100).toFixed(1)}%)</li>
            <li style="padding: 8px 0;"><strong>Image Feedback:</strong> ${analytics.modalityMetrics.image} (${((analytics.modalityMetrics.image / analytics.totalResponses) * 100).toFixed(1)}%)</li>
          </ul>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">💬 Sentiment Breakdown</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 8px 0;">
              <span style="color: #10b981;">✅ Positive:</span> ${analytics.sentimentMetrics.positive} (${((analytics.sentimentMetrics.positive / analytics.totalResponses) * 100).toFixed(1)}%)
            </li>
            <li style="padding: 8px 0;">
              <span style="color: #6b7280;">➖ Neutral:</span> ${analytics.sentimentMetrics.neutral} (${((analytics.sentimentMetrics.neutral / analytics.totalResponses) * 100).toFixed(1)}%)
            </li>
            <li style="padding: 8px 0;">
              <span style="color: #ef4444;">❌ Negative:</span> ${analytics.sentimentMetrics.negative} (${((analytics.sentimentMetrics.negative / analytics.totalResponses) * 100).toFixed(1)}%)
            </li>
          </ul>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">🌍 Top Languages</h3>
          <ul style="list-style: none; padding: 0;">
            ${analytics.languageMetrics.topLanguages
              .slice(0, 5)
              .map(
                (lang) =>
                  `<li style="padding: 8px 0;"><strong>${lang.language}:</strong> ${lang.count} responses</li>`
              )
              .join('')}
          </ul>
        </div>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">⚙️ Processing Status</h3>
          <p><strong>Audio:</strong> ${analytics.processingMetrics.audio.ready} ready, ${analytics.processingMetrics.audio.processing} processing, ${analytics.processingMetrics.audio.failed} failed</p>
          <p><strong>Video:</strong> ${analytics.processingMetrics.video.ready} ready, ${analytics.processingMetrics.video.processing} processing, ${analytics.processingMetrics.video.failed} failed</p>
          ${analytics.processingMetrics.image.total > 0 ? `<p><strong>Images:</strong> ${analytics.processingMetrics.image.total} uploaded</p>` : ''}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/surveys/${surveyId}/analytics" 
             style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View Full Analytics →
          </a>
        </div>

        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px;">
          This is an automated digest from your feedback system.
        </p>
      </div>
    `

    const client = getResendClient()
    if (!client) {
      console.warn('[SurveyDigest] Resend not configured — skipping send')
      return { success: false, error: 'Resend not configured' }
    }

    const { error } = await client.emails.send({
      from: process.env.EMAIL_FROM || 'Earn4Insights <notifications@earn4insights.com>',
      to: recipientEmail,
      subject,
      html,
    })

    if (error) {
      console.error('[SurveyDigest] Send failed:', error)
      return { success: false, error: String(error) }
    }

    console.log(`[SurveyDigest] Email sent to ${recipientEmail} for survey ${surveyId}`)
    return { success: true }
  } catch (error) {
    console.error('Failed to send survey digest email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send digests for all active surveys (can be called by cron)
 */
export async function sendAllSurveyDigests(params: {
  recipientEmail: string
  periodDays?: number
}): Promise<{ sent: number; failed: number; errors: string[] }> {
  // This would need to fetch all active surveys and send digests
  // For now, returning a placeholder
  return {
    sent: 0,
    failed: 0,
    errors: ['Not yet implemented - needs survey listing logic'],
  }
}
