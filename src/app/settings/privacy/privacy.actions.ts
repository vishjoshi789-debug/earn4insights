'use server'

import { getUserProfile, updateConsent, updateNotificationPreferences } from '@/db/repositories/userProfileRepository'
import { trackPrivacySettingsUpdate } from '@/server/eventTrackingService'
import { revalidatePath } from 'next/cache'

export async function updateUserConsent(userId: string, consent: {
  tracking?: boolean
  personalization?: boolean
  analytics?: boolean
  marketing?: boolean
}) {
  try {
    await updateConsent(userId, consent)
    
    // Track privacy settings update
    await trackPrivacySettingsUpdate(userId, { type: 'consent', changes: consent }).catch(console.error)
    
    revalidatePath('/settings/privacy')
    return { success: true }
  } catch (error) {
    console.error('Error updating consent:', error)
    return { success: false, error: String(error) }
  }
}

export async function updateChannelPreferences(userId: string, channel: 'email' | 'whatsapp' | 'sms', preferences: {
  enabled?: boolean
  frequency?: 'instant' | 'daily' | 'weekly'
  quietHours?: { start: string; end: string }
}) {
  try {
    const profile = await getUserProfile(userId)
    if (!profile) throw new Error('Profile not found')

    const currentPrefs = (profile.notificationPreferences as any) || {}
    const updatedPrefs = {
      ...currentPrefs,
      [channel]: {
        ...currentPrefs[channel],
        ...preferences
      }
    }

    await updateNotificationPreferences(userId, updatedPrefs)
    
    // Track privacy settings update
    await trackPrivacySettingsUpdate(userId, { type: 'notifications', channel, changes: preferences }).catch(console.error)
    
    revalidatePath('/settings/privacy')
    return { success: true }
  } catch (error) {
    console.error('Error updating channel preferences:', error)
    return { success: false, error: String(error) }
  }
}
