import { db } from '@/db'
import { userProfiles, type UserProfile, type NewUserProfile } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { trackProfileUpdate } from '@/server/eventTrackingService'

// Default notification preferences for new users
const DEFAULT_NOTIFICATION_PREFS = {
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
