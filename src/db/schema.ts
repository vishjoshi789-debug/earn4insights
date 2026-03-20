import { pgTable, text, timestamp, jsonb, boolean, integer, real, uuid, serial, date, decimal } from 'drizzle-orm/pg-core'

// ════════════════════════════════════════════════════════════════
// SECTION 1: USERS & AUTHENTICATION
// ════════════════════════════════════════════════════════════════

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
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Features
  npsEnabled: boolean('nps_enabled').default(false).notNull(),
  feedbackEnabled: boolean('feedback_enabled').default(false).notNull(),
  socialListeningEnabled: boolean('social_listening_enabled').default(false).notNull(),
  
  // Phase 5: Product Lifecycle & Claiming
  // Lifecycle states: 'verified' (brand onboarded), 'pending_verification' (consumer-created),
  //                   'merged' (duplicate resolved into canonical product)
  lifecycleStatus: text('lifecycle_status').default('verified').notNull(),
  
  // Brand ownership (userId of brand owner, null for unclaimed placeholders)
  ownerId: text('owner_id'),
  
  // Claiming
  claimable: boolean('claimable').default(false).notNull(), // Can brands claim this product?
  claimedAt: timestamp('claimed_at'),
  claimedBy: text('claimed_by'), // userId who claimed it
  
  // If merged, points to the canonical product
  mergedIntoId: text('merged_into_id'),
  mergedAt: timestamp('merged_at'),
  
  // Who created this product (brand onboarding vs consumer placeholder)
  createdBy: text('created_by'), // userId
  creationSource: text('creation_source').default('brand_onboarding').notNull(),
  // 'brand_onboarding' | 'consumer_feedback' | 'admin_import' | 'api'
  
  // Search optimization
  nameNormalized: text('name_normalized'), // lowercase, trimmed, for fuzzy search
  
  // Product profile (stored as JSONB)
  profile: jsonb('profile').$type<{
    category?: string
    categoryName?: string
    website?: string
    [key: string]: any
  }>().notNull(),
})

// ════════════════════════════════════════════════════════════════
// SECTION 2: SURVEYS & RESPONSES
// ════════════════════════════════════════════════════════════════

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

// Social media posts table — enhanced for full social listening
export const socialPosts = pgTable('social_posts', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  platform: text('platform').notNull(), // 'twitter' | 'instagram' | 'tiktok' | 'meta' | 'google' | 'amazon' | 'flipkart' | 'reddit' | 'youtube' | 'linkedin'
  postType: text('post_type').default('mention').notNull(), // 'mention' | 'review' | 'comment' | 'discussion' | 'complaint' | 'praise'
  content: text('content').notNull(),
  title: text('title'), // For reviews/threads that have a title
  url: text('url'),

  // Author info
  author: text('author'),
  authorHandle: text('author_handle'),
  authorAvatar: text('author_avatar'),
  authorFollowers: integer('author_followers'),
  isVerifiedAuthor: boolean('is_verified_author').default(false).notNull(),

  // Engagement metrics
  likes: integer('likes').default(0).notNull(),
  shares: integer('shares').default(0).notNull(),
  comments: integer('comments').default(0).notNull(),
  views: integer('views').default(0),
  rating: real('rating'), // 1–5 star rating for review platforms

  // Analysis
  sentiment: text('sentiment'), // 'positive' | 'neutral' | 'negative'
  sentimentScore: real('sentiment_score'), // -1 to 1
  engagementScore: real('engagement_score'), // 0–1 normalized
  influenceScore: real('influence_score'), // 0–1 based on author reach
  relevanceScore: real('relevance_score'), // 0–1 how relevant this post is to the product
  isKeyOpinionLeader: boolean('is_key_opinion_leader').default(false).notNull(),

  // Categorisation
  category: text('category'), // 'product_feedback' | 'brand_mention' | 'customer_support' | 'feature_request' | 'comparison' | 'other'
  keywords: jsonb('keywords').$type<string[]>().default([]),
  language: text('language'),

  // Ingestion metadata
  source: text('source').default('scraper').notNull(), // 'scraper' | 'api' | 'brand_submitted' | 'webhook'
  externalId: text('external_id'), // Platform-native ID for dedup
  parentPostId: text('parent_post_id'), // For replies/threads

  // Timestamps
  postedAt: timestamp('posted_at'), // When the post was originally made on the platform
  createdAt: timestamp('created_at').defaultNow().notNull(),
  scrapedAt: timestamp('scraped_at').defaultNow().notNull(),
})

// ════════════════════════════════════════════════════════════════
// SECTION 3: FEEDBACK & MEDIA
// ════════════════════════════════════════════════════════════════

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

// Brand Subscriptions table (Phase 4: Tier System)
// Tracks which brands have paid for premium analytics features
export const brandSubscriptions = pgTable('brand_subscriptions', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().unique(), // User ID of brand owner
  
  // Subscription tier
  tier: text('tier').notNull().default('free'), // 'free' | 'pro' | 'enterprise'
  status: text('status').notNull().default('active'), // 'active' | 'cancelled' | 'past_due' | 'trialing'
  
  // Stripe integration (optional, for future)
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  
  // Billing
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAt: timestamp('cancel_at'),
  canceledAt: timestamp('canceled_at'),
  trialStart: timestamp('trial_start'),
  trialEnd: timestamp('trial_end'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Feature overrides (for custom plans or granular control)
  featureOverrides: jsonb('feature_overrides').$type<{
    canViewIndividualFeedback?: boolean
    canPlayMedia?: boolean
    canExportData?: boolean
    canAccessAPI?: boolean
    maxProducts?: number
    maxResponses?: number
    [key: string]: any
  }>(),
})

// ════════════════════════════════════════════════════════════════
// SECTION 4: USER PROFILES & PERSONALIZATION
// ════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════
// SECTION 5: NOTIFICATIONS & CAMPAIGNS
// ════════════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════════════
// SECTION 6: ANALYTICS, AUDIT & SEND-TIME OPTIMIZATION
// ══════════════════════════════════════════════════════════════════

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

// ── Granular Personalization: Consumer Watchlist ──────────────────
export const productWatchlist = pgTable('product_watchlist', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  productId: text('product_id').notNull(),
  watchType: text('watch_type').notNull().default('launch'),
  // 'launch' | 'price_drop' | 'feature' | 'update' | 'any'
  desiredFeature: text('desired_feature'),   // free-text: "dark mode", "iOS app", etc.
  notifyChannels: jsonb('notify_channels').$type<string[]>().default(['email']),
  // ['email'] | ['email','whatsapp'] | etc.
  active: boolean('active').notNull().default(true),
  notifiedAt: timestamp('notified_at'),      // last time we sent a match notification
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Granular Personalization: Consumer Intent Signals ─────────────
export const consumerIntents = pgTable('consumer_intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  productId: text('product_id'),             // nullable — intent may be category-level
  categorySlug: text('category_slug'),       // e.g. 'TECH_SAAS', 'FOOD_BEVERAGE'
  intentType: text('intent_type').notNull(),
  // 'want_product' | 'want_feature' | 'frustrated' | 'price_sensitive' | 'purchase_ready' | 'churning'
  extractedText: text('extracted_text'),      // the phrase that triggered extraction
  confidence: real('confidence').notNull().default(0.5), // 0.0–1.0
  sourceType: text('source_type').notNull(),  // 'feedback' | 'survey' | 'watchlist'
  sourceId: text('source_id'),               // feedbackId or surveyResponseId
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Granular Personalization: Brand Alert Rules ───────────────────
export const brandAlertRules = pgTable('brand_alert_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),       // userId of the brand
  alertType: text('alert_type').notNull(),
  // 'new_feedback' | 'negative_feedback' | 'survey_complete' | 'high_intent_consumer'
  // | 'watchlist_milestone' | 'frustration_spike'
  productId: text('product_id'),             // null = all products
  channels: jsonb('channels').$type<string[]>().default(['in_app']),
  // ['in_app'] | ['in_app','email'] | etc.
  threshold: jsonb('threshold').$type<Record<string, any>>(),
  // e.g. { minSeverity: 'negative' } or { watchlistCount: 10 }
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Granular Personalization: Brand Alerts ────────────────────────
export const brandAlerts = pgTable('brand_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),
  ruleId: text('rule_id'),                   // which alert rule triggered this (nullable for system alerts)
  alertType: text('alert_type').notNull(),
  productId: text('product_id'),
  consumerId: text('consumer_id'),           // which consumer triggered it (nullable)
  title: text('title').notNull(),
  body: text('body').notNull(),
  payload: jsonb('payload').$type<Record<string, any>>(), // extra context
  channel: text('channel').notNull().default('in_app'),
  status: text('status').notNull().default('pending'),
  // 'pending' | 'sent' | 'read' | 'dismissed'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  sentAt: timestamp('sent_at'),
  readAt: timestamp('read_at'),
})

// ── Phase 8: AI-Powered Theme Extraction ──────────────────────────
export const extractedThemes = pgTable('extracted_themes', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  theme: text('theme').notNull(),
  mentionCount: integer('mention_count').notNull().default(0),
  sentiment: text('sentiment').notNull().default('mixed'), // 'positive' | 'negative' | 'neutral' | 'mixed'
  examples: jsonb('examples').$type<string[]>().default([]),
  totalFeedbackAnalyzed: integer('total_feedback_analyzed').notNull().default(0),
  extractedAt: timestamp('extracted_at').defaultNow().notNull(),
  extractionMethod: text('extraction_method').notNull().default('keyword'), // 'openai' | 'keyword'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ══════════════════════════════════════════════════════════════════
// SECTION 7: DEEP ANALYTICS EVENTS
// ══════════════════════════════════════════════════════════════════

// ── Deep Analytics: Every user interaction ────────────────────────
export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Session + user
  sessionId: text('session_id').notNull(),
  userId: text('user_id'),             // null for anonymous visitors
  userRole: text('user_role'),         // 'brand' | 'consumer' | null
  anonymousId: text('anonymous_id'),   // browser fingerprint

  // Event
  eventType: text('event_type').notNull(),     // 'page_view' | 'click' | 'scroll' | 'form_submit' | 'signup' | 'login' | 'logout' | 'payment' | 'custom'
  eventName: text('event_name').notNull(),     // e.g. 'button_click', 'page_view', 'feedback_submitted'
  eventData: jsonb('event_data').$type<Record<string, any>>(), // flexible payload

  // Page context
  pageUrl: text('page_url').notNull(),
  pageTitle: text('page_title'),
  pagePath: text('page_path'),
  referrer: text('referrer'),
  utmSource: text('utm_source'),
  utmMedium: text('utm_medium'),
  utmCampaign: text('utm_campaign'),

  // Click details (for click events)
  elementTag: text('element_tag'),       // 'BUTTON', 'A', 'INPUT', etc.
  elementText: text('element_text'),     // button/link text content
  elementId: text('element_id'),         // DOM id
  elementClass: text('element_class'),   // CSS classes
  clickX: integer('click_x'),
  clickY: integer('click_y'),

  // Device + browser
  deviceType: text('device_type'),       // 'desktop' | 'mobile' | 'tablet'
  browser: text('browser'),              // 'Chrome 120', 'Safari 17', etc.
  os: text('os'),                        // 'Windows 11', 'iOS 17', 'Android 14', etc.
  screenWidth: integer('screen_width'),
  screenHeight: integer('screen_height'),
  viewportWidth: integer('viewport_width'),
  viewportHeight: integer('viewport_height'),
  language: text('language'),            // browser language, e.g. 'en-US'

  // Location (from server-side IP lookup)
  country: text('country'),
  region: text('region'),
  city: text('city'),
  timezone: text('timezone'),
  ip: text('ip'),

  // Timing
  sessionStart: timestamp('session_start'),
  timeOnPage: integer('time_on_page'),   // seconds
  scrollDepth: integer('scroll_depth'),  // percentage 0-100
  pageLoadTime: integer('page_load_time'), // milliseconds

  // Metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ══════════════════════════════════════════════════════════════════
// SECTION 8: IN-APP COMMUNITY
// ══════════════════════════════════════════════════════════════════

// ── Community Posts (threads / discussions) ────────────────────────
export const communityPosts = pgTable('community_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: text('author_id').notNull(),
  productId: text('product_id'),             // nullable — general discussion or product-linked
  title: text('title').notNull(),
  body: text('body').notNull(),
  postType: text('post_type').notNull().default('discussion'),
  // 'discussion' | 'ama' | 'announcement' | 'feature_request' | 'tips' | 'poll'
  isPinned: boolean('is_pinned').notNull().default(false),
  isLocked: boolean('is_locked').notNull().default(false),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  replyCount: integer('reply_count').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  tags: jsonb('tags').$type<string[]>().default([]),
  pollOptions: jsonb('poll_options').$type<{ id: string; text: string; votes: number }[]>(),
  // only populated when postType = 'poll'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Community Replies ─────────────────────────────────────────────
export const communityReplies = pgTable('community_replies', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  authorId: text('author_id').notNull(),
  parentReplyId: uuid('parent_reply_id'),    // nullable — for nested replies
  body: text('body').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  downvotes: integer('downvotes').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Community Reactions (upvote/downvote on posts & replies) ──────
export const communityReactions = pgTable('community_reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  postId: uuid('post_id'),                   // one of postId or replyId must be set
  replyId: uuid('reply_id'),
  reactionType: text('reaction_type').notNull(), // 'upvote' | 'downvote'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Community Poll Votes ──────────────────────────────────────────
export const communityPollVotes = pgTable('community_poll_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  userId: text('user_id').notNull(),
  optionId: text('option_id').notNull(),     // matches pollOptions[].id
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ══════════════════════════════════════════════════════════════════
// SECTION 9: REWARDS & PAYMENTS
// ══════════════════════════════════════════════════════════════════

// ── User Points Balance ──────────────────────────────────────────
export const userPoints = pgTable('user_points', {
  userId: text('user_id').primaryKey(),
  totalPoints: integer('total_points').notNull().default(0),
  lifetimePoints: integer('lifetime_points').notNull().default(0), // never decreases
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Point Transactions ───────────────────────────────────────────
export const pointTransactions = pgTable('point_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  amount: integer('amount').notNull(),        // positive = earn, negative = spend
  type: text('type').notNull(),               // 'earn' | 'spend' | 'refund'
  source: text('source').notNull(),
  // sources: 'feedback_submit' | 'survey_complete' | 'community_post' | 'community_reply'
  //          | 'community_upvote_received' | 'challenge_complete' | 'reward_redeem' | 'payout' | 'admin_adjustment'
  sourceId: text('source_id'),                // FK to the thing that triggered it
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Rewards Catalog ──────────────────────────────────────────────
export const rewards = pgTable('rewards', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  pointsCost: integer('points_cost').notNull(),
  stock: integer('stock'),                    // null = unlimited
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Reward Redemptions ───────────────────────────────────────────
export const rewardRedemptions = pgTable('reward_redemptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  rewardId: uuid('reward_id').notNull(),
  pointsSpent: integer('points_spent').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'fulfilled' | 'cancelled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  fulfilledAt: timestamp('fulfilled_at'),
})

// ── Payout Requests ──────────────────────────────────────────────
export const payoutRequests = pgTable('payout_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  points: integer('points').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // USD
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'denied'
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  processedBy: text('processed_by'),          // admin user id
  note: text('note'),
})

// ── Challenges ───────────────────────────────────────────────────
export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  pointsReward: integer('points_reward').notNull(),
  targetCount: integer('target_count').notNull().default(1), // e.g. submit 5 feedbacks
  sourceType: text('source_type').notNull(),  // 'feedback' | 'survey' | 'community_post' | 'community_reply'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── User Challenge Progress ──────────────────────────────────────
export const userChallengeProgress = pgTable('user_challenge_progress', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  challengeId: uuid('challenge_id').notNull(),
  currentCount: integer('current_count').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ════════════════════════════════════════════════════════════════
// SECTION: AI-DRIVEN CONTRIBUTION INTELLIGENCE & REWARD SYSTEM
// ════════════════════════════════════════════════════════════════

// ── Contribution Events (unified event pipeline) ─────────────────
export const contributionEvents = pgTable('contribution_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  contributionType: text('contribution_type').notNull(),
  // types: 'feedback_submit' | 'survey_complete' | 'community_post' | 'community_reply' | 'community_upvote_received' | 'poll_vote'
  rawContent: text('raw_content'),             // the actual text/content
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  // metadata: { length, wordCount, productId, postType, rating, sentiment, ... }
  brandId: text('brand_id'),                   // product owner (if applicable)
  productId: text('product_id'),
  sourceId: text('source_id'),                 // FK to the original record
  // AI scoring results
  qualityScore: real('quality_score'),         // 0-100 AI-computed score
  qualityReasoning: text('quality_reasoning'), // AI explanation
  relevanceScore: real('relevance_score'),     // 0-100 brand relevance
  depthScore: real('depth_score'),             // 0-100 insightfulness
  clarityScore: real('clarity_score'),         // 0-100 structured/clear
  noveltyScore: real('novelty_score'),         // 0-100 non-duplicate
  actionabilityScore: real('actionability_score'), // 0-100 usable by product team
  authenticityScore: real('authenticity_score'),   // 0-100 not spam
  // Reward computation
  basePoints: integer('base_points'),          // static points before multiplier
  brandWeight: real('brand_weight').default(1.0), // brand priority multiplier
  qualityMultiplier: real('quality_multiplier').default(1.0),
  reputationMultiplier: real('reputation_multiplier').default(1.0),
  finalTokens: integer('final_tokens'),        // actual tokens awarded
  // Processing state
  scoredAt: timestamp('scored_at'),
  status: text('status').notNull().default('pending'),
  // statuses: 'pending' | 'scored' | 'rewarded' | 'flagged' | 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Brand Reward Config (brand-weighted priorities) ──────────────
export const brandRewardConfigs = pgTable('brand_reward_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),
  productId: text('product_id'),               // null = brand-wide config
  contributionType: text('contribution_type').notNull(),
  weight: real('weight').notNull().default(1.0),
  // priority areas brands care about (affect scoring weight)
  priorityKeywords: jsonb('priority_keywords').$type<string[]>(),
  bonusMultiplier: real('bonus_multiplier').default(1.0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── User Reputation (trust + earning multiplier) ─────────────────
export const userReputation = pgTable('user_reputation', {
  userId: text('user_id').primaryKey(),
  reputationScore: real('reputation_score').notNull().default(50), // 0-100
  tier: text('tier').notNull().default('bronze'),
  // tiers: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  earningMultiplier: real('earning_multiplier').notNull().default(1.0),
  totalContributions: integer('total_contributions').notNull().default(0),
  qualityAvg: real('quality_avg').notNull().default(0),       // rolling average quality score
  flagCount: integer('flag_count').notNull().default(0),       // spam/fraud flags
  streakDays: integer('streak_days').notNull().default(0),     // consecutive days with contribution
  lastContributionAt: timestamp('last_contribution_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Brand Quality Feedback (continuous learning loop) ────────────
export const brandQualityFeedback = pgTable('brand_quality_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  contributionEventId: uuid('contribution_event_id').notNull(),
  brandUserId: text('brand_user_id').notNull(),
  rating: text('rating').notNull(),            // 'useful' | 'not_useful' | 'insightful'
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Trust Flags (anti-gaming) ────────────────────────────────────
export const trustFlags = pgTable('trust_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  flagType: text('flag_type').notNull(),
  // types: 'spam' | 'bot_behavior' | 'low_effort_pattern' | 'duplicate_farming' | 'velocity_abuse'
  severity: text('severity').notNull().default('warning'),
  // severities: 'warning' | 'moderate' | 'severe'
  details: text('details'),
  contributionEventId: uuid('contribution_event_id'),
  resolved: boolean('resolved').notNull().default(false),
  resolvedBy: text('resolved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
export type ExtractedTheme = typeof extractedThemes.$inferSelect
export type NewExtractedTheme = typeof extractedThemes.$inferInsert
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert
export type ProductWatchlistEntry = typeof productWatchlist.$inferSelect
export type NewProductWatchlistEntry = typeof productWatchlist.$inferInsert
export type ConsumerIntent = typeof consumerIntents.$inferSelect
export type NewConsumerIntent = typeof consumerIntents.$inferInsert
export type BrandAlertRule = typeof brandAlertRules.$inferSelect
export type NewBrandAlertRule = typeof brandAlertRules.$inferInsert
export type BrandAlert = typeof brandAlerts.$inferSelect
export type NewBrandAlert = typeof brandAlerts.$inferInsert
export type CommunityPost = typeof communityPosts.$inferSelect
export type NewCommunityPost = typeof communityPosts.$inferInsert
export type CommunityReply = typeof communityReplies.$inferSelect
export type NewCommunityReply = typeof communityReplies.$inferInsert
export type CommunityReaction = typeof communityReactions.$inferSelect
export type NewCommunityReaction = typeof communityReactions.$inferInsert
export type CommunityPollVote = typeof communityPollVotes.$inferSelect
export type NewCommunityPollVote = typeof communityPollVotes.$inferInsert
export type UserPoints = typeof userPoints.$inferSelect
export type PointTransaction = typeof pointTransactions.$inferSelect
export type NewPointTransaction = typeof pointTransactions.$inferInsert
export type RewardItem = typeof rewards.$inferSelect
export type NewRewardItem = typeof rewards.$inferInsert
export type RewardRedemption = typeof rewardRedemptions.$inferSelect
export type NewRewardRedemption = typeof rewardRedemptions.$inferInsert
export type PayoutRequest = typeof payoutRequests.$inferSelect
export type NewPayoutRequest = typeof payoutRequests.$inferInsert
export type ChallengeRow = typeof challenges.$inferSelect
export type NewChallengeRow = typeof challenges.$inferInsert
export type UserChallengeProgressRow = typeof userChallengeProgress.$inferSelect
export type NewUserChallengeProgressRow = typeof userChallengeProgress.$inferInsert
export type ContributionEvent = typeof contributionEvents.$inferSelect
export type NewContributionEvent = typeof contributionEvents.$inferInsert
export type BrandRewardConfig = typeof brandRewardConfigs.$inferSelect
export type NewBrandRewardConfig = typeof brandRewardConfigs.$inferInsert
export type UserReputationRow = typeof userReputation.$inferSelect
export type BrandQualityFeedbackRow = typeof brandQualityFeedback.$inferSelect
export type TrustFlag = typeof trustFlags.$inferSelect
