/**
 * Slack Notification Service
 *
 * Sends notifications to a brand's configured Slack channel via Incoming Webhooks.
 * No SDK required — Slack webhooks are simple HTTP POST requests.
 *
 * Setup for brands:
 * 1. Brand creates an Incoming Webhook in their Slack workspace
 * 2. Brand saves the webhook URL in their alert rule (stored in brand_alert_rules.slack_webhook_url)
 *
 * Global fallback (optional):
 * Set SLACK_WEBHOOK_URL env var for a single platform-level webhook (e.g., ops/support channel).
 */

export interface SlackMessage {
  webhookUrl: string
  title: string
  body: string
  alertType?: string
  productName?: string
  consumerName?: string
  metadata?: Record<string, any>
}

const alertTypeEmoji: Record<string, string> = {
  new_feedback: ':speech_balloon:',
  negative_feedback: ':warning:',
  survey_complete: ':bar_chart:',
  high_intent_consumer: ':rocket:',
  watchlist_milestone: ':eyes:',
  frustration_spike: ':rotating_light:',
}

/**
 * Send a notification to a Slack channel via Incoming Webhook URL.
 * Returns true on success, false (non-throwing) on failure.
 */
export async function sendSlackNotification(msg: SlackMessage): Promise<boolean> {
  const { webhookUrl, title, body, alertType, productName, consumerName, metadata } = msg

  // Validate webhook URL to prevent SSRF — must be a Slack URL
  if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
    console.error('[Slack] Rejected non-Slack webhook URL')
    return false
  }

  const emoji = alertType ? (alertTypeEmoji[alertType] || ':bell:') : ':bell:'

  // Build Slack Block Kit payload for a clean, readable message
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} ${title}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: body,
      },
    },
  ]

  // Add context line with product / consumer if available
  const contextElements: any[] = []
  if (productName) {
    contextElements.push({ type: 'mrkdwn', text: `*Product:* ${productName}` })
  }
  if (consumerName) {
    contextElements.push({ type: 'mrkdwn', text: `*Consumer:* ${consumerName}` })
  }
  contextElements.push({
    type: 'mrkdwn',
    text: `*Time:* <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
  })

  if (contextElements.length > 0) {
    blocks.push({ type: 'context', elements: contextElements })
  }

  // Add view button linking to alerts dashboard
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View in Dashboard' },
        url: 'https://earn4insights.com/dashboard/alerts',
        action_id: 'view_alerts',
      },
    ],
  })

  const payload = {
    blocks,
    // Fallback text for notifications that don't render blocks
    text: `${title}: ${body}`,
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[Slack] Webhook returned ${res.status}: ${text}`)
      return false
    }

    console.log(`[Slack] Notification sent for alertType=${alertType || 'unknown'}`)
    return true
  } catch (err) {
    console.error('[Slack] Failed to send notification:', err)
    return false
  }
}
