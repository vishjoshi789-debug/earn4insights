import { db } from '@/db'
import { notificationQueue, type NewNotificationQueue } from '@/db/schema'
import { getUserProfile, adaptNotificationPreferences, type NotificationPreferences } from '@/db/repositories/userProfileRepository'
import { eq, and, lte, gte } from 'drizzle-orm'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Queue a notification for sending
 */
export async function queueNotification(data: {
  userId: string
  channel: 'email' | 'whatsapp' | 'sms'
  type: string
  subject?: string
  body: string
  metadata?: any
  priority?: number
  scheduledFor?: Date
}): Promise<string | null> {
  // Get user profile to check preferences
  const profile = await getUserProfile(data.userId)
  if (!profile) {
    console.log(`[Notifications] User ${data.userId} profile not found`)
    return null
  }

  // Safely adapt notification preferences (handles schema versioning)
  const prefs = adaptNotificationPreferences(profile.notificationPreferences)
  if (!prefs[data.channel].enabled) {
    console.log(`[Notifications] User ${data.userId} has ${data.channel} disabled`)
    return null
  }

  // Check quiet hours (if scheduling for immediate send)
  if (!data.scheduledFor || data.scheduledFor <= new Date()) {
    const quietHours = prefs[data.channel].quietHours
    if (quietHours && isInQuietHours(quietHours)) {
      // Reschedule for after quiet hours
      const scheduledFor = getNextAvailableTime(quietHours)
      console.log(`[Notifications] Rescheduling for after quiet hours: ${scheduledFor}`)
      data.scheduledFor = scheduledFor
    }
  }

  const notification: NewNotificationQueue = {
    userId: data.userId,
    channel: data.channel,
    type: data.type,
    status: 'pending',
    priority: data.priority || 5,
    subject: data.subject || null,
    body: data.body,
    metadata: data.metadata || null,
    scheduledFor: data.scheduledFor || new Date(),
    retryCount: 0
  }

  const result = await db.insert(notificationQueue).values(notification).returning()
  console.log(`[Notifications] Queued ${data.channel} notification ${result[0].id} for user ${data.userId}`)
  return result[0].id
}

/**
 * Send pending notifications
 */
export async function processPendingNotifications(): Promise<void> {
  const now = new Date()

  // Get all pending notifications that are due
  const pending = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, 'pending'),
        lte(notificationQueue.scheduledFor, now)
      )
    )
    .limit(100) // Process in batches

  console.log(`[Notifications] Processing ${pending.length} pending notifications`)

  for (const notification of pending) {
    try {
      if (notification.channel === 'email') {
        await sendEmail(notification)
      } else if (notification.channel === 'whatsapp') {
        await sendWhatsApp(notification)
      } else if (notification.channel === 'sms') {
        await sendSMS(notification)
      }

      // Mark as sent
      await db
        .update(notificationQueue)
        .set({
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(notificationQueue.id, notification.id))

      console.log(`[Notifications] Sent ${notification.channel} notification ${notification.id}`)
    } catch (error) {
      console.error(`[Notifications] Failed to send ${notification.id}:`, error)

      // Retry logic (max 3 retries)
      const retryCount = notification.retryCount + 1
      if (retryCount <= 3) {
        // Exponential backoff: 5min, 15min, 45min
        const delayMinutes = Math.pow(3, retryCount) * 5
        const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000)

        await db
          .update(notificationQueue)
          .set({
            retryCount,
            scheduledFor: nextRetry,
            failureReason: String(error)
          })
          .where(eq(notificationQueue.id, notification.id))
      } else {
        // Max retries exceeded
        await db
          .update(notificationQueue)
          .set({
            status: 'failed',
            failedAt: new Date(),
            failureReason: String(error)
          })
          .where(eq(notificationQueue.id, notification.id))
      }
    }
  }
}

/**
 * Send email via Resend
 */
async function sendEmail(notification: typeof notificationQueue.$inferSelect): Promise<void> {
  const profile = await getUserProfile(notification.userId)
  if (!profile) throw new Error('User profile not found')
  
  // Safely adapt notification preferences
  const prefs = adaptNotificationPreferences(profile.notificationPreferences)

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'Earn4Insights <notifications@earn4insights.com>',
    to: profile.email,
    subject: notification.subject || 'Notification from Earn4Insights',
    html: notification.body
  })
}

/**
 * Send WhatsApp message (STUB - to be implemented with WhatsApp Business API)
 */
async function sendWhatsApp(notification: typeof notificationQueue.$inferSelect): Promise<void> {
  console.log('[Notifications] WhatsApp sending not yet implemented')
  // TODO: Implement with WhatsApp Business API
  // - Get user's WhatsApp number from profile
  // - Send via WhatsApp Business API
  throw new Error('WhatsApp not yet implemented')
}

/**
 * Send SMS (STUB - to be implemented with Twilio)
 */
async function sendSMS(notification: typeof notificationQueue.$inferSelect): Promise<void> {
  console.log('[Notifications] SMS sending not yet implemented')
  // TODO: Implement with Twilio
  // - Get user's phone number from profile
  // - Send via Twilio API
  throw new Error('SMS not yet implemented')
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(quietHours: { start: string; end: string }): boolean {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  const currentTime = currentHour * 60 + currentMinute

  const [startHour, startMinute] = quietHours.start.split(':').map(Number)
  const [endHour, endMinute] = quietHours.end.split(':').map(Number)
  const startTime = startHour * 60 + startMinute
  const endTime = endHour * 60 + endMinute

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime
  }

  return currentTime >= startTime && currentTime < endTime
}

/**
 * Get next available time after quiet hours
 */
function getNextAvailableTime(quietHours: { start: string; end: string }): Date {
  const [endHour, endMinute] = quietHours.end.split(':').map(Number)
  const nextAvailable = new Date()
  nextAvailable.setHours(endHour, endMinute, 0, 0)

  // If end time is earlier than current time, schedule for tomorrow
  if (nextAvailable <= new Date()) {
    nextAvailable.setDate(nextAvailable.getDate() + 1)
  }

  return nextAvailable
}

/**
 * Cancel a notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await db
    .update(notificationQueue)
    .set({ status: 'cancelled' })
    .where(eq(notificationQueue.id, notificationId))
}

/**
 * Get notification statistics for a user
 */
export async function getNotificationStats(userId: string, days: number = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)

  const notifications = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.userId, userId),
        gte(notificationQueue.createdAt, cutoffDate)
      )
    )

  const stats = {
    total: notifications.length,
    sent: notifications.filter(n => n.status === 'sent').length,
    pending: notifications.filter(n => n.status === 'pending').length,
    failed: notifications.filter(n => n.status === 'failed').length,
    cancelled: notifications.filter(n => n.status === 'cancelled').length,
    byChannel: {
      email: notifications.filter(n => n.channel === 'email').length,
      whatsapp: notifications.filter(n => n.channel === 'whatsapp').length,
      sms: notifications.filter(n => n.channel === 'sms').length
    }
  }

  return stats
}
