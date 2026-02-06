import { pgTable, text, timestamp, jsonb, boolean, integer, real, uuid, serial, date, decimal } from 'drizzle-orm/pg-core'

// Users table (for authentication)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull(), // 'brand' | 'consumer'
  passwordHash: text('password_hash'), // For email/password auth
  googleId: text('google_id'), // For Google OAuth
  consent: jsonb('consent'), // { termsAcceptedAt, privacyAcceptedAt }
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Products table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  platform: text('platform'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // Features
  npsEnabled: boolean('nps_enabled').default(false).notNull(),
  feedbackEnabled: boolean('feedback_enabled').default(false).notNull(),
  socialListeningEnabled: boolean('social_listening_enabled').default(false).notNull(),
  
  // Product profile (stored as JSONB)
  profile: jsonb('profile').$type<{
    category?: string
    categoryName?: string
    website?: string
    [key: string]: any
  }>().notNull(),
})

// Surveys table
export const surveys = pgTable('surveys', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'nps' | 'feedback' | 'custom'
  status: text('status').default('draft').notNull(), // 'draft' | 'active' | 'paused' | 'completed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Survey configuration
  questions: jsonb('questions').notNull(),
  settings: jsonb('settings'),
})

// Survey responses table
export const surveyResponses = pgTable('survey_responses', {
  id: text('id').primaryKey(),
  surveyId: text('survey_id').notNull(),
  productId: text('product_id').notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  
  // User info
  userName: text('user_name'),
  userEmail: text('user_email'),
  
  // Response data
  answers: jsonb('answers').notNull(),
  npsScore: integer('nps_score'),
  sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'

  // Multimodal + multilingual foundations (Phase 0)
  modalityPrimary: text('modality_primary').default('text').notNull(), // 'text' | 'audio' | 'video' | 'mixed'
  processingStatus: text('processing_status').default('ready').notNull(), // 'ready' | 'processing' | 'failed'

  // Language + normalization (optional until Phase 1)
  originalLanguage: text('original_language'), // e.g., 'en', 'hi', 'es'
  languageConfidence: real('language_confidence'), // 0..1
  normalizedText: text('normalized_text'), // translated/normalized text for analytics
  normalizedLanguage: text('normalized_language'), // e.g., 'en'

  // Transcript (optional; used for audio/video once enabled)
  transcriptText: text('transcript_text'),
  transcriptConfidence: real('transcript_confidence'), // 0..1

  // Consent (explicit for audio/video/images)
  consentAudio: boolean('consent_audio').default(false).notNull(),
  consentVideo: boolean('consent_video').default(false).notNull(),
  consentImages: boolean('consent_images').default(false).notNull(),
  consentCapturedAt: timestamp('consent_captured_at'),

  // Flexible metadata for future analytics/debugging
  multimodalMetadata: jsonb('multimodal_metadata').$type<Record<string, any>>(),
})

// Generic media attachments (Phase 0)
// - Works for both survey responses and product feedback
// - ownerType: 'survey_response' | 'feedback'
export const feedbackMedia = pgTable('feedback_media', {
  id: uuid('id').defaultRandom().primaryKey(),

  ownerType: text('owner_type').notNull(),
  ownerId: text('owner_id').notNull(),

  mediaType: text('media_type').notNull(), // 'audio' | 'video'
  storageProvider: text('storage_provider').notNull(), // 'vercel_blob' | 's3' | ...
  storageKey: text('storage_key').notNull(), // provider key/path
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  durationMs: integer('duration_ms'),

  status: text('status').default('uploaded').notNull(), // 'uploaded' | 'processing' | 'ready' | 'failed' | 'deleted'
  transcriptText: text('transcript_text'),
  transcriptConfidence: real('transcript_confidence'),
  originalLanguage: text('original_language'),
  languageConfidence: real('language_confidence'),

  errorCode: text('error_code'),
  errorDetail: text('error_detail'),

  // Phase 1.5 hardening
  retryCount: integer('retry_count').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  lastErrorAt: timestamp('last_error_at'),

  // Retention / cost controls (Phase 1.5)
  deletedAt: timestamp('deleted_at'),
  retentionReason: text('retention_reason'),

  // Moderation / review (Phase 2 foundation)
  // - null/undefined means "visible" (default)
  // - 'hidden' hides from dashboard playback/exports
  // - 'flagged' indicates needs review
  moderationStatus: text('moderation_status'),
  moderationNote: text('moderation_note'),
  moderatedAt: timestamp('moderated_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Weekly rankings table
export const weeklyRankings = pgTable('weekly_rankings', {
  id: text('id').primaryKey(),
  weekStart: timestamp('week_start').notNull(),
  weekEnd: timestamp('week_end').notNull(),
  category: text('category').notNull(),
  categoryName: text('category_name').notNull(),
  products: jsonb('products').notNull(), // Array of ranked products
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Ranking history table (for tracking changes over time)
export const rankingHistory = pgTable('ranking_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  category: text('category').notNull(),
  weekStart: timestamp('week_start').notNull(),
  rank: integer('rank').notNull(),
  score: real('score').notNull(),
  metrics: jsonb('metrics').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Social media posts table
export const socialPosts = pgTable('social_posts', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  platform: text('platform').notNull(), // 'twitter' | 'linkedin' | 'reddit'
  content: text('content').notNull(),
  url: text('url'),
  author: text('author'),
  sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
  engagementScore: real('engagement_score'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
})

// User feedback table
export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  userName: text('user_name'),
  userEmail: text('user_email'),
  feedbackText: text('feedback_text').notNull(),
  rating: integer('rating'), // 1-5 stars
  sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
  category: text('category'), // e.g., 'bug', 'feature-request', 'general'
  status: text('status').default('new').notNull(), // 'new' | 'reviewed' | 'addressed'
  createdAt: timestamp('created_at').defaultNow().notNull(),

  // Multimodal + multilingual foundations (Phase 0)
  modalityPrimary: text('modality_primary').default('text').notNull(), // 'text' | 'audio' | 'video' | 'mixed'
  processingStatus: text('processing_status').default('ready').notNull(), // 'ready' | 'processing' | 'failed'

  originalLanguage: text('original_language'),
  languageConfidence: real('language_confidence'),
  normalizedText: text('normalized_text'),
  normalizedLanguage: text('normalized_language'),
  transcriptText: text('transcript_text'),
  transcriptConfidence: real('transcript_confidence'),

  consentAudio: boolean('consent_audio').default(false).notNull(),
  consentVideo: boolean('consent_video').default(false).notNull(),
  consentCapturedAt: timestamp('consent_captured_at'),

  multimodalMetadata: jsonb('multimodal_metadata').$type<Record<string, any>>(),
})

// User profiles table (for personalization)
export const userProfiles = pgTable('user_profiles', {
  id: text('id').primaryKey(), // Will match user ID from auth
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Onboarding status
  onboardingComplete: boolean('onboarding_complete').default(false).notNull(),
  
  // Explicit demographics (user-provided)
  demographics: jsonb('demographics'), // { gender, ageRange, location, language, education }
  
  // Interests (user-selected tags)
  interests: jsonb('interests'), // { productCategories: string[], topics: string[] }
  
  // Notification preferences
  notificationPreferences: jsonb('notification_preferences').notNull(), 
  // { email: { enabled, frequency, quietHours }, whatsapp: {...}, sms: {...} }
  
  // Consent tracking
  consent: jsonb('consent').notNull(),
  // { tracking: boolean, personalization: boolean, analytics: boolean, marketing: boolean, grantedAt: timestamp }
  
  // Behavioral attributes (system-computed)
  behavioral: jsonb('behavioral'),
  // { engagementScore, lastActiveAt, surveyCompletionRate, productViewCount, interests: { [category]: score } }
  
  // Sensitive data (opt-in only, encrypted at rest)
  sensitiveData: jsonb('sensitive_data'),
  // { spendingCapacity, explicitIncome } - never inferred
})

// User events table (for behavior tracking)
export const userEvents = pgTable('user_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(), // 'product_view', 'survey_start', 'survey_complete', 'notification_click', etc.
  productId: text('product_id'),
  surveyId: text('survey_id'),
  notificationId: text('notification_id'),
  metadata: jsonb('metadata'), // Flexible event data
  sessionId: text('session_id'),
  schemaVersion: integer('schema_version').default(1).notNull(), // Track event schema version for backward compatibility
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Notification queue table
export const notificationQueue = pgTable('notification_queue', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  channel: text('channel').notNull(), // 'email' | 'whatsapp' | 'sms'
  type: text('type').notNull(), // 'new_survey', 'weekly_digest', 'product_update', etc.
  status: text('status').default('pending').notNull(), // 'pending' | 'sent' | 'failed' | 'cancelled'
  priority: integer('priority').default(5).notNull(), // 1 (highest) to 10 (lowest)
  
  // Content
  subject: text('subject'),
  body: text('body').notNull(),
  metadata: jsonb('metadata'), // Additional data (productId, surveyId, etc.)
  
  // Scheduling
  scheduledFor: timestamp('scheduled_for').notNull(),
  sentAt: timestamp('sent_at'),
  failedAt: timestamp('failed_at'),
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Audit Log table (for GDPR compliance and security)
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // 'read', 'write', 'delete', 'export'
  dataType: text('data_type').notNull(), // 'sensitiveData', 'profile', 'events', etc.
  accessedBy: text('accessed_by').notNull(), // userId or 'system' or 'cron'
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
  reason: text('reason'), // Why the data was accessed
})

// Email Send Events table (for send-time optimization)
export const emailSendEvents = pgTable('email_send_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  notificationId: uuid('notification_id'),
  emailType: text('email_type').notNull(), // 'survey_notification', 'weekly_digest', etc.
  sentAt: timestamp('sent_at').notNull(),
  sendHour: integer('send_hour').notNull(), // Hour of day (0-23)
  sendDayOfWeek: integer('send_day_of_week').notNull(), // Day of week (0=Sunday, 6=Saturday)
  
  // User demographics snapshot
  userAgeBracket: text('user_age_bracket'),
  userIncomeBracket: text('user_income_bracket'),
  userIndustry: text('user_industry'),
  
  // Engagement tracking
  opened: boolean('opened').default(false),
  openedAt: timestamp('opened_at'),
  clicked: boolean('clicked').default(false),
  clickedAt: timestamp('clicked_at'),
  converted: boolean('converted').default(false),
  convertedAt: timestamp('converted_at'),
  
  // Time-to-engagement metrics (in minutes)
  timeToOpen: integer('time_to_open'),
  timeToClick: integer('time_to_click'),
  timeToConvert: integer('time_to_convert'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Send Time Cohorts table (for A/B testing send times)
export const sendTimeCohorts = pgTable('send_time_cohorts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  cohortName: text('cohort_name').notNull(), // 'morning', 'lunch', 'evening', 'night', 'weekend', 'control'
  sendHourMin: integer('send_hour_min').notNull(),
  sendHourMax: integer('send_hour_max').notNull(),
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  
  // Performance metrics
  emailsSent: integer('emails_sent').default(0),
  emailsClicked: integer('emails_clicked').default(0),
  clickRate: decimal('click_rate', { precision: 5, scale: 4 }),
  avgTimeToClick: integer('avg_time_to_click'),
  
  lastUpdated: timestamp('last_updated').defaultNow(),
})

// Send Time Analytics table (aggregated statistics)
export const sendTimeAnalytics = pgTable('send_time_analytics', {
  id: serial('id').primaryKey(),
  analysisDate: date('analysis_date').notNull(),
  sendHour: integer('send_hour').notNull(),
  
  // Overall metrics
  emailsSent: integer('emails_sent').default(0),
  emailsOpened: integer('emails_opened').default(0),
  emailsClicked: integer('emails_clicked').default(0),
  emailsConverted: integer('emails_converted').default(0),
  
  // Rates
  openRate: decimal('open_rate', { precision: 5, scale: 4 }),
  clickRate: decimal('click_rate', { precision: 5, scale: 4 }),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 4 }),
  
  // Timing metrics
  avgTimeToOpen: integer('avg_time_to_open'),
  avgTimeToClick: integer('avg_time_to_click'),
  avgTimeToConvert: integer('avg_time_to_convert'),
  
  // Statistical analysis
  sampleSize: integer('sample_size'),
  variance: decimal('variance', { precision: 10, scale: 6 }),
  optimizationEnabled: boolean('optimization_enabled').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Demographic Performance table
export const demographicPerformance = pgTable('demographic_performance', {
  id: serial('id').primaryKey(),
  analysisDate: date('analysis_date').notNull(),
  segmentType: text('segment_type').notNull(), // 'age', 'income', 'industry'
  segmentValue: text('segment_value').notNull(),
  
  // Metrics
  emailsSent: integer('emails_sent').default(0),
  emailsClicked: integer('emails_clicked').default(0),
  clickRate: decimal('click_rate', { precision: 5, scale: 4 }),
  avgTimeToClick: integer('avg_time_to_click'),
  
  // Optimal send time for this segment
  optimalSendHour: integer('optimal_send_hour'),
  optimalHourClickRate: decimal('optimal_hour_click_rate', { precision: 5, scale: 4 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
export type Survey = typeof surveys.$inferSelect
export type NewSurvey = typeof surveys.$inferInsert
export type SurveyResponse = typeof surveyResponses.$inferSelect
export type NewSurveyResponse = typeof surveyResponses.$inferInsert
export type WeeklyRanking = typeof weeklyRankings.$inferSelect
export type NewWeeklyRanking = typeof weeklyRankings.$inferInsert
export type RankingHistory = typeof rankingHistory.$inferSelect
export type NewRankingHistory = typeof rankingHistory.$inferInsert
export type SocialPost = typeof socialPosts.$inferSelect
export type NewSocialPost = typeof socialPosts.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type NewFeedback = typeof feedback.$inferInsert
export type FeedbackMedia = typeof feedbackMedia.$inferSelect
export type NewFeedbackMedia = typeof feedbackMedia.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type UserEvent = typeof userEvents.$inferSelect
export type NewUserEvent = typeof userEvents.$inferInsert
export type NotificationQueue = typeof notificationQueue.$inferSelect
export type NewNotificationQueue = typeof notificationQueue.$inferInsert
export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
export type EmailSendEvent = typeof emailSendEvents.$inferSelect
export type NewEmailSendEvent = typeof emailSendEvents.$inferInsert
export type SendTimeCohort = typeof sendTimeCohorts.$inferSelect
export type NewSendTimeCohort = typeof sendTimeCohorts.$inferInsert
export type SendTimeAnalytics = typeof sendTimeAnalytics.$inferSelect
export type NewSendTimeAnalytics = typeof sendTimeAnalytics.$inferInsert
export type DemographicPerformance = typeof demographicPerformance.$inferSelect
export type NewDemographicPerformance = typeof demographicPerformance.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
