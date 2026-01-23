import twilio from 'twilio'

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

export interface WhatsAppRankingData {
  productName: string
  rank: number
  category: string
  previousRank?: number
  score: number
  phoneNumber: string // Must be in format: +1234567890
  ownerName?: string
}

/**
 * Send WhatsApp ranking notification
 */
export async function sendWhatsAppRankingNotification(data: WhatsAppRankingData) {
  if (!twilioClient || !process.env.TWILIO_WHATSAPP_FROM) {
    console.warn('⚠️ Twilio not configured, skipping WhatsApp notification')
    return { success: false, error: 'Twilio not configured' }
  }

  try {
    const emoji = data.rank === 1 ? '🥇' : data.rank === 2 ? '🥈' : data.rank === 3 ? '🥉' : '🏆'
    
    const rankChange = data.previousRank
      ? data.rank - data.previousRank
      : null

    const rankChangeText = rankChange !== null
      ? rankChange < 0
        ? `📈 Up ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? 's' : ''}!`
        : rankChange > 0
        ? `📉 Down ${rankChange} position${rankChange > 1 ? 's' : ''}`
        : '➡️ Position unchanged'
      : ''

    const message = `
${emoji} *Weekly Ranking Update*

Hi ${data.ownerName || 'there'}! 

Great news about *${data.productName}*:

🏆 *Rank #${data.rank}*
📊 Category: ${data.category}
⭐ Score: ${data.score.toFixed(2)}
${rankChangeText}

Keep up the great work! 🚀

View full rankings: ${process.env.NEXT_PUBLIC_APP_URL}/top-products
`.trim()

    const result = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${data.phoneNumber}`,
    })

    console.log(`✅ WhatsApp notification sent to ${data.phoneNumber}`)
    return { success: true, data: result }
  } catch (error) {
    console.error('Failed to send WhatsApp notification:', error)
    return { success: false, error }
  }
}

/**
 * Send bulk WhatsApp notifications
 */
export async function sendBulkWhatsAppNotifications(notifications: WhatsAppRankingData[]) {
  const results = await Promise.allSettled(
    notifications.map(data => sendWhatsAppRankingNotification(data))
  )

  const successful = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  console.log(`📱 WhatsApp notifications: ${successful} sent, ${failed} failed`)

  return {
    total: notifications.length,
    successful,
    failed,
    results,
  }
}
