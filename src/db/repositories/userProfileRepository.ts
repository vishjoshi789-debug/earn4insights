import { db } from '@/db'
import { userProfiles, type UserProfile, type NewUserProfile } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { trackProfileUpdate } from '@/server/eventTrackingService'
import { logSensitiveDataAccess } from '@/lib/audit-log'
import { encryptSensitiveData, decryptSensitiveData, isEncrypted } from '@/lib/encryption'
import { encryptSensitiveData, decryptSensitiveData, isEncrypted } from '@/lib/encryption'

/**
 * VERSIONED NOTIFICATION PREFERENCES SCHEMA
 * Version: 1.0
 * Last updated: Feb 2026
 * 
 * IMPORTANT: When adding new fields, increment SCHEMA_VERSION and add migration logic
 */
export const NOTIFICATION_PREFS_SCHEMA_VERSION = 1

export type NotificationChannelPrefs = {
  enabled: boolean
  frequency: 'instant' | 'daily' | 'weekly'
  quietHours: { start: string; end: string }
}

export type NotificationPreferences = {
  schemaVersion?: number // Track schema version
  email: NotificationChannelPrefs
  whatsapp: NotificationChannelPrefs
  sms: NotificationChannelPrefs
}

// Default notification preferences for new users
const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  schemaVersion: NOTIFICATION_PREFS_SCHEMA_VERSION,
  email: {
    enabled: true,
    frequency: 'instant', // 'instant' | 'daily' | 'weekly'
    quietHours: { start: '22:00', end: '08:00' }
  },
  whatsapp: {
    enabled: false,
    frequency: 'weekly',
    quietHours: { start: '22:00', end: '08:00' }
  },
  sms: {
    enabled: false,
    frequency: 'instant',
    quietHours: { start: '22:00', end: '08:00' }
  }
}

/**
 * Preference Schema Adapter
 * Safely migrates old preference schemas to current version
 */
export function adaptNotificationPreferences(prefs: any): NotificationPreferences {
  if (!prefs) return DEFAULT_NOTIFICATION_PREFS
  
  // Check if already current version
  if (prefs.schemaVersion === NOTIFICATION_PREFS_SCHEMA_VERSION) {
    return prefs as NotificationPreferences
  }
  
  // Migration logic for version upgrades
  const adapted: NotificationPreferences = {
    schemaVersion: NOTIFICATION_PREFS_SCHEMA_VERSION,
    email: prefs.email || DEFAULT_NOTIFICATION_PREFS.email,
    whatsapp: prefs.whatsapp || DEFAULT_NOTIFICATION_PREFS.whatsapp,
    sms: prefs.sms || DEFAULT_NOTIFICATION_PREFS.sms
  }
  
  // Ensure all required fields exist with defaults
  for (const channel of ['email', 'whatsapp', 'sms'] as const) {
    if (!adapted[channel]) {
      adapted[channel] = DEFAULT_NOTIFICATION_PREFS[channel]
    } else {
      // Ensure nested fields exist
      adapted[channel] = {
        enabled: adapted[channel].enabled ?? DEFAULT_NOTIFICATION_PREFS[channel].enabled,
        frequency: adapted[channel].frequency || DEFAULT_NOTIFICATION_PREFS[channel].frequency,
        quietHours: adapted[channel].quietHours || DEFAULT_NOTIFICATION_PREFS[channel].quietHours
      }
    }
  }
  
  return adapted
}

// Default consent settings (all opt-in required)
const DEFAULT_CONSENT = {
  tracking: false,
  personalization: false,
  analytics: false,
  marketing: false,
  grantedAt: null
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const profiles = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  
  return profiles[0] || null
}

/**
 * Get user profile by email
 */
export async function getUserProfileByEmail(email: string): Promise<UserProfile | null> {
  const profiles = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.email, email))
    .limit(1)
  
  return profiles[0] || null
}

/**
 * Create a new user profile
 */
export async function createUserProfile(data: {
  id: string
  email: string
  demographics?: any
  interests?: any
}): Promise<UserProfile> {
  const newProfile: NewUserProfile = {
    id: data.id,
    email: data.email,
    demographics: data.demographics || null,
    interests: data.interests || null,
    notificationPreferences: DEFAULT_NOTIFICATION_PREFS,
    consent: DEFAULT_CONSENT,
    behavioral: null,
    sensitiveData: null
  }

  const result = await db.insert(userProfiles).values(newProfile).returning()
  return result[0]
}

/**
 * Update user profile demographics
 */
export async function updateDemographics(
  userId: string,
  demographics: {
    gender?: string
    ageRange?: string
    location?: string
    language?: string
    education?: string
  }
): Promise<UserProfile | null> {
  // Get old value for tracking
  const oldProfile = await getUserProfile(userId)
  
  const result = await db
    .update(userProfiles)
    .set({
      demographics: demographics,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  // Track profile update
  if (result[0]) {
    await trackProfileUpdate(
      userId, 
      'demographics', 
      oldProfile?.demographics, 
      demographics
    ).catch(console.error)
  }

  return result[0] || null
}

/**
 * Update user interests
 */
export async function updateInterests(
  userId: string,
  interests: {
    productCategories?: string[]
    topics?: string[]
  }
): Promise<UserProfile | null> {
  // Get old value for tracking
  const oldProfile = await getUserProfile(userId)
  
  const result = await db
    .update(userProfiles)
    .set({
      interests: interests,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  // Track profile update
  if (result[0]) {
    await trackProfileUpdate(
      userId, 
      'interests', 
      oldProfile?.interests, 
      interests
    ).catch(console.error)
  }

  return result[0] || null
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: any
): Promise<UserProfile | null> {
  const result = await db
    .update(userProfiles)
    .set({
      notificationPreferences: preferences,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  return result[0] || null
}

/**
 * Update consent settings
 */
export async function updateConsent(
  userId: string,
  consent: {
    tracking?: boolean
    personalization?: boolean
    analytics?: boolean
    marketing?: boolean
  }
): Promise<UserProfile | null> {
  // Get current consent to preserve grantedAt timestamp
  const currentProfile = await getUserProfile(userId)
  const currentConsent = (currentProfile?.consent as any) || DEFAULT_CONSENT

  const updatedConsent = {
    ...currentConsent,
    ...consent,
    grantedAt: new Date().toISOString()
  }

  const result = await db
    .update(userProfiles)
    .set({
      consent: updatedConsent,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  return result[0] || null
}

/**
 * Update behavioral attributes (system-computed)
 */
export async function updateBehavioral(
  userId: string,
  behavioral: {
    engagementScore?: number
    lastActiveAt?: string
    surveyCompletionRate?: number
    productViewCount?: number
    interests?: Record<string, number>
  }
): Promise<UserProfile | null> {
  const result = await db
    .update(userProfiles)
    .set({
      behavioral: behavioral,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  return result[0] || null
}

/**
 * Check if user has given consent for specific purpose
 */
export async function hasConsent(userId: string, purpose: 'tracking' | 'personalization' | 'analytics' | 'marketing'): Promise<boolean> {
  const profile = await getUserProfile(userId)
  if (!profile) return false

  const consent = profile.consent as any
  return consent?.[purpose] === true
}

/**
 * Get all users who opted in for specific notification channel
 */
export async function getUsersOptedInForChannel(channel: 'email' | 'whatsapp' | 'sms'): Promise<UserProfile[]> {
  const allProfiles = await db.select().from(userProfiles)
  
  // Filter in-memory for now (can optimize with raw SQL later)
  return allProfiles.filter(profile => {
    const prefs = profile.notificationPreferences as any
    return prefs?.[channel]?.enabled === true
  })
}

/**
 * Delete user profile (GDPR right to be forgotten)
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  await db.delete(userProfiles).where(eq(userProfiles.id, userId))
}

/**
 * Access sensitive data with audit logging
 * 
 * This function logs all access to the sensitiveData field for GDPR compliance
 * and security monitoring.
 * 
 * @param userId - User ID whose sensitive data to access
 * @param accessedBy - Who is accessing (userId, 'system', 'admin', etc.)
 * @param reason - Why the data is being accessed
 * @param metadata - Additional context
 * @returns Sensitive data object or null
 */
export async function accessSensitiveData(
  userId: string,
  accessedBy: string,
  reason: string,
  metadata?: Record<string, any>
): Promise<any | null> {
  // Log the access for audit trail
  await logSensitiveDataAccess(userId, accessedBy, reason, metadata)

  // Fetch the profile
  const profile = await getUserProfile(userId)
  
  if (!profile) {
    console.warn(`[SensitiveData] Profile not found for user ${userId}`)
    return null
  }

  // Return null if no sensitive data
  if (!profile.sensitiveData) {
    return null
  }

  // Decrypt if encrypted (check if it's a base64 string)
  const data = profile.sensitiveData
  if (typeof data === 'string' && isEncrypted(data)) {
    try {
      const decrypted = await decryptSensitiveData(data)
      console.log(`[SensitiveData] ✓ Decrypted data for user ${userId}`)
      return decrypted
    } catch (error) {
      console.error('[SensitiveData] Decryption failed:', error)
      return null
    }
  }

  // Return as-is if not encrypted (backward compatibility)
  return data
}

/**
 * Update sensitive data with audit logging
 * 
 * @param userId - User ID
 * @param data - Sensitive data to store
 * @param updatedBy - Who is updating
 * @param reason - Why it's being updated
 */
export async function updateSensitiveData(
  userId: string,
  data: any,
  updatedBy: string,
  reason: string
): Promise<UserProfile | null> {
  // Log the write operation
  await logSensitiveDataAccess(userId, updatedBy, `UPDATE: ${reason}`, {
    operation: 'write',
    dataKeys: Object.keys(data || {})
  })

  // Encrypt sensitive data before storing
  let encryptedData: any
  try {
    encryptedData = await encryptSensitiveData(data)
    console.log(`[SensitiveData] ✓ Encrypted data for user ${userId}`)
  } catch (error) {
    console.error('[SensitiveData] Encryption failed:', error)
    throw new Error('Failed to encrypt sensitive data')
  }

  const result = await db
    .update(userProfiles)
    .set({
      sensitiveData: encryptedData,
      updatedAt: new Date()
    })
    .where(eq(userProfiles.id, userId))
    .returning()

  return result[0] || null
}

