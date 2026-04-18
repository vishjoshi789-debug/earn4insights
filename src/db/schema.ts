import { pgTable, text, timestamp, jsonb, boolean, integer, real, uuid, serial, date, decimal, index } from 'drizzle-orm/pg-core'

// ════════════════════════════════════════════════════════════════
// SECTION 1: USERS & AUTHENTICATION
// ════════════════════════════════════════════════════════════════

// Users table (for authentication)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull(), // 'brand' | 'consumer'
  isInfluencer: boolean('is_influencer').notNull().default(false), // true = consumer can access influencer features
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

  // Phase 9: Hyper-personalization signal extensions
  psychographic: jsonb('psychographic'),
  // { aspirations: string[], lifestyle: string[], values: string[],
  //   interests: string[], spendingStyle: string }
  // Voluntary, requires 'psychographic' consent record
  socialSignals: jsonb('social_signals'),
  // { inferredInterests: Record<string,number>, platform: string, lastSyncedAt: string }
  // Inferred from connected social accounts, requires 'social' consent record
  signalVersion: text('signal_version').default('1.0'),
  // Schema version for forward-compat signal reading
  lastSignalComputedAt: timestamp('last_signal_computed_at'),
  // When signals were last aggregated and persisted to consumer_signal_snapshots
  lastActiveAt: timestamp('last_active_at'),
  // Updated when user connects to Pusher presence channel — used by OnlinePresenceIndicator
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

  // Phase 9: ICP-aware alert filtering
  icpId: uuid('icp_id'),
  // → brand_icps.id. When set, alert only fires if consumer match score >= minMatchScore
  minMatchScore: integer('min_match_score').default(60),
  // 0-100. Alert fires only if icp_match_scores.matchScore >= this value (default: 60)
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

  // Phase 9: ICP match score at the moment this alert was fired
  matchScoreSnapshot: jsonb('match_score_snapshot').$type<{
    matchScore: number
    criteriaScores: Record<string, { earned: number; max: number; matched?: string | string[]; reason?: string }>
    totalEarned: number
    totalPossible: number
    consentGaps: string[]
    explainability: string
  }>(),
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

// ════════════════════════════════════════════════════════════════
// SECTION: IMPORT JOBS (Self-Serve Data Import Tracking)
// ════════════════════════════════════════════════════════════════

export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),
  
  // Import source & method
  source: text('source').notNull(), // 'csv' | 'webhook_v1' | 'webhook_v2'
  fileName: text('file_name'), // Original filename for CSV imports
  
  // Column mapping (for CSV imports)
  columnMapping: jsonb('column_mapping').$type<Record<string, string>>(), 
  // e.g. { "Product ID": "productId", "Review Text": "feedbackText", "Stars": "rating" }
  
  // Status tracking
  status: text('status').notNull().default('pending'),
  // 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
  
  // Counts
  totalRows: integer('total_rows').notNull().default(0),
  importedRows: integer('imported_rows').notNull().default(0),
  skippedRows: integer('skipped_rows').notNull().default(0),
  duplicateRows: integer('duplicate_rows').notNull().default(0),
  
  // Error tracking
  errors: jsonb('errors').$type<string[]>().default([]),
  
  // Default product assignment
  defaultProductId: text('default_product_id'),
  
  // Metadata
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
})

// ── Password Reset Tokens ────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),       // SHA-256 hash of the token (never store raw)
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),                  // set when token is consumed
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ══════════════════════════════════════════════════════════════════
// SECTION 10: HYPER-PERSONALIZATION ENGINE (Phase 9)
// ══════════════════════════════════════════════════════════════════

// ── Consumer Signal Snapshots (append-only time-series) ───────────
// Each row is an immutable snapshot of one signal category for one user
// at a point in time. Never updated — new snapshots are inserted.
// Retention: SIGNAL_RETENTION_DAYS (default 365) rolling window.
export const consumerSignalSnapshots = pgTable('consumer_signal_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),           // → users.id
  signalCategory: text('signal_category').notNull(),
  // 'behavioral' | 'demographic' | 'psychographic' | 'sensitive' | 'social'
  signals: jsonb('signals').$type<Record<string, any>>().notNull(),
  // Shape varies by category — see design doc for per-category JSONB shapes
  triggeredBy: text('triggered_by').notNull(),
  // 'cron_daily' | 'onboarding_complete' | 'feedback_submit' | 'social_sync' | 'manual'
  schemaVersion: text('schema_version').notNull().default('1.0'),
  snapshotAt: timestamp('snapshot_at').defaultNow().notNull(),
})

// ── Consent Records (per-category, individually revocable) ────────
// Replaces userProfiles.consent JSONB blob.
// One row per user per dataCategory — independently grantable and revocable.
// GDPR Art. 7 / India DPDP Act 2023 §6 compliance.
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),           // → users.id

  dataCategory: text('data_category').notNull().$type<
    // Standard categories
    | 'behavioral'
    | 'demographic'
    | 'psychographic'
    | 'social'
    // Special categories (GDPR Art. 9 / DPDP sensitive personal data)
    | 'sensitive_health'
    | 'sensitive_dietary'
    | 'sensitive_religion'
    | 'sensitive_caste'
    // Legacy categories (migrated from userProfiles.consent JSONB)
    | 'tracking'
    | 'personalization'
    | 'analytics'
    | 'marketing'
  >(),

  purpose: text('purpose').notNull(),
  // Human-readable notice shown to user at grant time.
  // e.g. "Personalising product recommendations based on your browsing behaviour"

  legalBasis: text('legal_basis').notNull().default('explicit_consent').$type<
    'explicit_consent' | 'legitimate_interest' | 'contract'
  >(),
  // sensitive_* categories MUST use 'explicit_consent'

  granted: boolean('granted').notNull().default(false),
  grantedAt: timestamp('granted_at'),          // set when granted = true
  revokedAt: timestamp('revoked_at'),          // set when user withdraws consent

  consentVersion: text('consent_version').notNull(),
  // Policy version shown at grant time, e.g. 'privacy-policy-v2.1'
  // Critical for proving what the user agreed to

  ipAddress: text('ip_address'),               // captured at grant time
  userAgent: text('user_agent'),               // captured at grant time

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // UNIQUE (userId, dataCategory) enforced in migration SQL
})

// ── Consumer Sensitive Attributes (GDPR Art. 9 special categories) ─
// Religion, caste, dietary, health — stored encrypted, independently deletable.
// NEVER queried in bulk analytics. Read only on explicit consumer request
// or (with consent) in ICP scoring.
export const consumerSensitiveAttributes = pgTable('consumer_sensitive_attributes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),           // → users.id
  attributeCategory: text('attribute_category').notNull().$type<
    'religion' | 'caste' | 'dietary' | 'health'
  >(),
  encryptedValue: text('encrypted_value').notNull(),
  // AES-256-GCM encrypted JSON string via encryptForStorage()
  // Plaintext shapes per category:
  //   religion:  { faith: string, practices?: string[] }
  //   caste:     { community: string }
  //   dietary:   { preferences: string[], allergies?: string[] }
  //   health:    { interests: string[] }
  encryptionKeyId: text('encryption_key_id').notNull(),
  // e.g. "v1", "v2" — used to look up correct key for decryption
  // Supports key rotation: old rows keep old keyId until re-encrypted
  consentRecordId: uuid('consent_record_id').notNull(),
  // → consent_records.id. The specific consent authorising this data.
  // If consent is revoked, this row must be deleted.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  // Soft delete on GDPR/DPDP erasure request.
  // Physical DELETE scheduled 30 days after deletedAt.
  // UNIQUE (userId, attributeCategory) WHERE deletedAt IS NULL — enforced in migration SQL
})

// ── Brand ICPs (Ideal Consumer Profiles) ─────────────────────────
// Brands define weighted targeting criteria.
// One brand can have multiple ICPs (per product, per campaign, or brand-wide).
export const brandIcps = pgTable('brand_icps', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),         // → users.id (role='brand')
  productId: text('product_id'),               // → products.id. NULL = brand-wide ICP
  name: text('name').notNull(),
  // e.g. "Urban Health-Conscious Female 25-35"
  description: text('description'),

  attributes: jsonb('attributes').$type<{
    version: string        // '1.0'
    criteria: Record<string, {
      values: string[]
      weight: number       // must sum to 100 across all criteria — enforced in service
      required: boolean
      requiresConsentCategory?: string   // e.g. 'psychographic' | 'sensitive_dietary'
    }>
    totalWeight: number    // must equal 100 — validated before save
  }>().notNull(),

  matchThreshold: integer('match_threshold').notNull().default(60),
  // 0-100. Alerts only fire when consumer match score >= this value.
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── ICP Match Scores (consumer ↔ ICP match cache) ─────────────────
// Persisted cache of match scores. Avoids re-computation on every alert.
// isStale=true means the score needs recomputing (done by daily cron).
// UNIQUE (icpId, consumerId) — upserted on each recompute.
export const icpMatchScores = pgTable('icp_match_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  icpId: uuid('icp_id').notNull(),             // → brand_icps.id
  consumerId: text('consumer_id').notNull(),   // → users.id

  matchScore: integer('match_score').notNull(), // 0-100

  breakdown: jsonb('breakdown').$type<{
    criteriaScores: Record<string, {
      earned: number
      max: number
      matched?: string | string[]
      reason?: string      // e.g. 'consent_not_granted' | 'no_signal_data'
    }>
    totalEarned: number
    totalPossible: number  // excludes unconsented criteria (normalised upward)
    consentGaps: string[]  // criteria skipped due to missing consent
    explainability: string // human-readable summary
  }>().notNull(),

  computedAt: timestamp('computed_at').defaultNow().notNull(),
  isStale: boolean('is_stale').notNull().default(false),
  // Set true when: consumer submits feedback, updates profile,
  // brand edits ICP, or daily cron (computedAt > 24h ago)
  // UNIQUE (icpId, consumerId) enforced in migration SQL
})

// ── Consumer Social Connections ───────────────────────────────────
// Connected social accounts for interest inference.
// Only inferred interest categories stored — no raw posts, no follower data.
// OAuth + sync implementation deferred to a later phase.
// Table created now to avoid a future ALTER TABLE.
export const consumerSocialConnections = pgTable('consumer_social_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),           // → users.id
  platform: text('platform').notNull().$type<
    'instagram' | 'twitter' | 'linkedin' | 'youtube'
  >(),
  encryptedAccessToken: text('encrypted_access_token'),
  // AES-256-GCM encrypted OAuth token. NULL after expiry or revocation.
  encryptionKeyId: text('encryption_key_id'),
  inferredInterests: jsonb('inferred_interests').$type<Record<string, number>>(),
  // { "fitness": 0.8, "travel": 0.6 } — normalised 0-1 per category
  // Derived from public interest signals only. No raw content stored.
  inferenceMethod: text('inference_method').$type<
    'followed_accounts' | 'public_profile_analysis'
  >(),
  consentRecordId: uuid('consent_record_id').notNull(),
  // → consent_records.id. Must have active 'social' consent to exist.
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  revokedAt: timestamp('revoked_at'),          // set when user disconnects account
  // UNIQUE (userId, platform) WHERE revokedAt IS NULL — enforced in migration SQL
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
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert
export type ImportJob = typeof importJobs.$inferSelect
export type NewImportJob = typeof importJobs.$inferInsert

// Phase 9: Hyper-personalization types
export type ConsumerSignalSnapshot = typeof consumerSignalSnapshots.$inferSelect
export type NewConsumerSignalSnapshot = typeof consumerSignalSnapshots.$inferInsert
export type ConsentRecord = typeof consentRecords.$inferSelect
export type NewConsentRecord = typeof consentRecords.$inferInsert
export type ConsumerSensitiveAttribute = typeof consumerSensitiveAttributes.$inferSelect
export type NewConsumerSensitiveAttribute = typeof consumerSensitiveAttributes.$inferInsert
export type BrandIcp = typeof brandIcps.$inferSelect
export type NewBrandIcp = typeof brandIcps.$inferInsert
export type IcpMatchScore = typeof icpMatchScores.$inferSelect
export type NewIcpMatchScore = typeof icpMatchScores.$inferInsert
export type ConsumerSocialConnection = typeof consumerSocialConnections.$inferSelect
export type NewConsumerSocialConnection = typeof consumerSocialConnections.$inferInsert

// ════════════════════════════════════════════════════════════════
// SECTION: INFLUENCERS ADDA — Influencer Marketing Marketplace
// ════════════════════════════════════════════════════════════════

export const influencerProfiles = pgTable('influencer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(),           // → users.id (consumer with isInfluencer=true)
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  niche: text('niche').array().notNull().default([]),   // ['beauty', 'tech', 'food']
  location: text('location'),
  instagramHandle: text('instagram_handle'),
  youtubeHandle: text('youtube_handle'),
  twitterHandle: text('twitter_handle'),
  linkedinHandle: text('linkedin_handle'),
  baseRate: integer('base_rate'),                       // smallest currency unit (paise for INR)
  currency: text('currency').notNull().default('INR'),
  verificationStatus: text('verification_status').notNull().default('unverified')
    .$type<'unverified' | 'pending' | 'verified'>(),
  isActive: boolean('is_active').notNull().default(true),
  portfolioUrls: jsonb('portfolio_urls').$type<{ url: string; title?: string; thumbnail?: string }[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const influencerSocialStats = pgTable('influencer_social_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  influencerId: text('influencer_id').notNull(),        // → users.id
  platform: text('platform').notNull()
    .$type<'instagram' | 'youtube' | 'twitter' | 'linkedin'>(),
  followerCount: integer('follower_count').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  avgViews: integer('avg_views'),
  avgLikes: integer('avg_likes'),
  avgComments: integer('avg_comments'),
  verifiedAt: timestamp('verified_at'),
  verificationMethod: text('verification_method').notNull().default('self_declared')
    .$type<'self_declared' | 'api_verified'>(),
  rawApiResponse: jsonb('raw_api_response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // UNIQUE (influencer_id, platform) enforced in migration
})

export const influencerContentPosts = pgTable('influencer_content_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  influencerId: text('influencer_id').notNull(),        // → users.id
  title: text('title').notNull(),
  body: text('body'),
  mediaType: text('media_type').notNull().default('image')
    .$type<'image' | 'video' | 'reel' | 'story' | 'carousel' | 'article'>(),
  mediaUrls: text('media_urls').array().default([]),
  thumbnailUrl: text('thumbnail_url'),
  platformsCrossPosted: text('platforms_cross_posted').array().default([]),
  productId: text('product_id'),                        // → products.id (nullable)
  brandId: text('brand_id'),                            // → users.id (nullable)
  campaignId: uuid('campaign_id'),                      // → influencer_campaigns.id (nullable, FK deferred)
  tags: text('tags').array().default([]),
  status: text('status').notNull().default('draft')
    .$type<'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'archived' | 'removed'>(),
  publishedAt: timestamp('published_at'),
  externalPostUrls: jsonb('external_post_urls').$type<Record<string, string>>().default({}),
  // Content approval fields (migration 006)
  reviewSubmittedAt: timestamp('review_submitted_at'),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: text('reviewed_by'),                       // → users.id (brand or admin who reviewed)
  rejectionReason: text('rejection_reason'),
  resubmissionCount: integer('resubmission_count').default(0),
  previousPostId: uuid('previous_post_id'),              // → influencer_content_posts.id (self-ref)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const influencerCampaigns = pgTable('influencer_campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),                  // → users.id (brand)
  productId: text('product_id'),                        // → products.id (nullable)
  icpId: uuid('icp_id'),                                // → brand_icps.id (nullable)
  title: text('title').notNull(),
  brief: text('brief'),
  requirements: text('requirements'),
  deliverables: text('deliverables').array().default([]),
  targetGeography: text('target_geography').array().default([]),
  targetPlatforms: text('target_platforms').array().default([]),
  budgetTotal: integer('budget_total').notNull(),       // smallest currency unit (paise)
  budgetCurrency: text('budget_currency').notNull().default('INR'),
  paymentType: text('payment_type').notNull().default('escrow')
    .$type<'escrow' | 'milestone' | 'direct'>(),
  status: text('status').notNull().default('draft')
    .$type<'draft' | 'proposed' | 'negotiating' | 'active' | 'completed' | 'cancelled' | 'disputed'>(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  platformFeePct: decimal('platform_fee_pct', { precision: 4, scale: 2 }).notNull().default('10.00'),
  // Content approval SLA (migration 006)
  reviewSlaHours: integer('review_sla_hours'),           // e.g. 24, 48, 72. NULL = no SLA
  autoApproveEnabled: boolean('auto_approve_enabled').default(false),
  // Marketplace (migration 007)
  isPublic: boolean('is_public').notNull().default(false),       // true = visible in marketplace
  maxInfluencers: integer('max_influencers'),                     // NULL = unlimited
  applicationDeadline: date('application_deadline'),              // NULL = no deadline
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const campaignInfluencers = pgTable('campaign_influencers', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  influencerId: text('influencer_id').notNull(),        // → users.id
  status: text('status').notNull().default('invited')
    .$type<'invited' | 'accepted' | 'rejected' | 'active' | 'completed'>(),
  deliverables: text('deliverables').array().default([]),
  agreedRate: integer('agreed_rate'),                   // negotiated rate (paise)
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // UNIQUE (campaign_id, influencer_id) enforced in migration
})

export const campaignMilestones = pgTable('campaign_milestones', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  title: text('title').notNull(),
  description: text('description'),
  dueDate: date('due_date'),
  paymentAmount: integer('payment_amount').notNull(),   // paise
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected'>(),
  completedAt: timestamp('completed_at'),
  approvedAt: timestamp('approved_at'),
  approvedBy: text('approved_by'),                      // → users.id (nullable)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const campaignPayments = pgTable('campaign_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  milestoneId: uuid('milestone_id'),                    // → campaign_milestones.id (nullable)
  amount: integer('amount').notNull(),                  // paise
  currency: text('currency').notNull().default('INR'),
  paymentType: text('payment_type').notNull()
    .$type<'escrow' | 'milestone' | 'direct'>(),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'escrowed' | 'released' | 'refunded' | 'failed'>(),
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpayTransferId: text('razorpay_transfer_id'),
  platformFee: integer('platform_fee').notNull().default(0),
  platformFeePercent: decimal('platform_fee_percent', { precision: 4, scale: 2 }),
  influencerAmount: integer('influencer_amount'),
  international: boolean('international').default(false),
  escrowedAt: timestamp('escrowed_at'),
  releasedAt: timestamp('released_at'),
  refundedAt: timestamp('refunded_at'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const campaignPerformance = pgTable('campaign_performance', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  postId: uuid('post_id'),                              // → influencer_content_posts.id (nullable)
  platform: text('platform').notNull(),
  metricDate: date('metric_date').notNull(),
  views: integer('views').default(0),
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
  shares: integer('shares').default(0),
  saves: integer('saves').default(0),
  clicks: integer('clicks').default(0),
  reach: integer('reach').default(0),
  impressions: integer('impressions').default(0),
  icpMatchedViewers: integer('icp_matched_viewers').default(0),
  dataSource: text('data_source').notNull().default('manual')
    .$type<'manual' | 'api' | 'estimated'>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // UNIQUE (post_id, platform, metric_date) enforced in migration
})

export const influencerFollows = pgTable('influencer_follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: text('consumer_id').notNull(),            // → users.id (consumer)
  influencerId: text('influencer_id').notNull(),        // → users.id (influencer)
  followedAt: timestamp('followed_at').defaultNow().notNull(),
  // UNIQUE (consumer_id, influencer_id) enforced in migration
})

export const influencerReviews = pgTable('influencer_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  reviewerId: text('reviewer_id').notNull(),            // → users.id
  revieweeId: text('reviewee_id').notNull(),            // → users.id
  rating: integer('rating').notNull(),                  // 1-5, CHECK enforced in migration
  review: text('review'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // UNIQUE (campaign_id, reviewer_id) enforced in migration
})

export const campaignDisputes = pgTable('campaign_disputes', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  raisedBy: text('raised_by').notNull(),                // → users.id
  reason: text('reason').notNull(),
  evidence: jsonb('evidence').$type<string[]>().default([]),
  status: text('status').notNull().default('open')
    .$type<'open' | 'under_review' | 'resolved' | 'closed'>(),
  resolvedBy: text('resolved_by'),                      // → users.id (admin)
  resolvedAt: timestamp('resolved_at'),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ════════════════════════════════════════════════════════════════
// SECTION: REAL-TIME CONNECTION LAYER (Feature 3 — April 2026)
// ════════════════════════════════════════════════════════════════

// Audit log of all platform events
export const realtimeEvents = pgTable('realtime_events', {
  id:                uuid('id').defaultRandom().primaryKey(),
  eventType:         text('event_type').notNull(),
  actorId:           text('actor_id'),                           // → users.id (nullable — system events have no actor)
  actorRole:         text('actor_role'),
  targetEntityType:  text('target_entity_type'),
  targetEntityId:    text('target_entity_id'),
  payload:           jsonb('payload'),
  icpFilterApplied:  boolean('icp_filter_applied').notNull().default(false),
  processedAt:       timestamp('processed_at'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
})

// Per-user notification store (source of truth for notification inbox)
export const notificationInbox = pgTable('notification_inbox', {
  id:        uuid('id').defaultRandom().primaryKey(),
  userId:    text('user_id').notNull(),                          // → users.id
  eventId:   uuid('event_id'),                                   // → realtime_events.id (nullable)
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  ctaUrl:    text('cta_url'),
  type:      text('type').notNull(),
  isRead:    boolean('is_read').notNull().default(false),
  readAt:    timestamp('read_at'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Per-user, per-event-type notification controls
// Works alongside the existing notificationPreferences JSONB (which controls channels + quiet hours)
// This table controls WHAT events to receive; the JSONB controls HOW/WHEN to deliver them
export const notificationPreferences = pgTable('notification_preferences', {
  id:             uuid('id').defaultRandom().primaryKey(),
  userId:         text('user_id').notNull(),                     // → users.id
  eventType:      text('event_type').notNull(),
  inAppEnabled:   boolean('in_app_enabled').notNull().default(true),
  emailEnabled:   boolean('email_enabled').notNull().default(true),
  smsEnabled:     boolean('sms_enabled').notNull().default(false),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
})

// Persistent activity stream per user
export const activityFeedItems = pgTable('activity_feed_items', {
  id:          uuid('id').defaultRandom().primaryKey(),
  userId:      text('user_id').notNull(),                        // → users.id
  eventType:   text('event_type').notNull(),
  actorId:     text('actor_id'),
  actorRole:   text('actor_role'),
  title:       text('title').notNull(),
  description: text('description'),
  entityType:  text('entity_type'),
  entityId:    text('entity_id'),
  metadata:    jsonb('metadata'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
})

// External social mention tracking (populated by webhook + cron)
export const socialMentions = pgTable('social_mentions', {
  id:                  uuid('id').defaultRandom().primaryKey(),
  platform:            text('platform').notNull(),
  mentionUrl:          text('mention_url'),
  mentionText:         text('mention_text').notNull(),
  mentionedEntityType: text('mentioned_entity_type').notNull(),
  mentionedEntityId:   text('mentioned_entity_id').notNull(),
  authorHandle:        text('author_handle'),
  authorFollowerCount: integer('author_follower_count'),
  sentimentScore:      decimal('sentiment_score', { precision: 5, scale: 4 }),
  relevanceScore:      decimal('relevance_score', { precision: 5, scale: 4 }),
  detectedAt:          timestamp('detected_at').defaultNow().notNull(),
  processedAt:         timestamp('processed_at'),
  notificationsSent:   boolean('notifications_sent').notNull().default(false),
})

// What keywords/platforms each entity wants monitored
export const socialListeningRules = pgTable('social_listening_rules', {
  id:          uuid('id').defaultRandom().primaryKey(),
  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  keywords:    text('keywords').array().notNull().default([]),
  platforms:   text('platforms').array().notNull().default([]),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

// Real-time Connection Layer types
export type RealtimeEvent = typeof realtimeEvents.$inferSelect
export type NewRealtimeEvent = typeof realtimeEvents.$inferInsert
export type NotificationInboxItem = typeof notificationInbox.$inferSelect
export type NewNotificationInboxItem = typeof notificationInbox.$inferInsert
export type NotificationPreference = typeof notificationPreferences.$inferSelect
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert
export type ActivityFeedItem = typeof activityFeedItems.$inferSelect
export type NewActivityFeedItem = typeof activityFeedItems.$inferInsert
export type SocialMention = typeof socialMentions.$inferSelect
export type NewSocialMention = typeof socialMentions.$inferInsert
export type SocialListeningRule = typeof socialListeningRules.$inferSelect
export type NewSocialListeningRule = typeof socialListeningRules.$inferInsert

// ════════════════════════════════════════════════════════════════

// Influencers Adda types
export type InfluencerProfile = typeof influencerProfiles.$inferSelect
export type NewInfluencerProfile = typeof influencerProfiles.$inferInsert
export type InfluencerSocialStat = typeof influencerSocialStats.$inferSelect
export type NewInfluencerSocialStat = typeof influencerSocialStats.$inferInsert
export type InfluencerContentPost = typeof influencerContentPosts.$inferSelect
export type NewInfluencerContentPost = typeof influencerContentPosts.$inferInsert
export type InfluencerCampaign = typeof influencerCampaigns.$inferSelect
export type NewInfluencerCampaign = typeof influencerCampaigns.$inferInsert
export type CampaignInfluencer = typeof campaignInfluencers.$inferSelect
export type NewCampaignInfluencer = typeof campaignInfluencers.$inferInsert
export type CampaignMilestone = typeof campaignMilestones.$inferSelect
export type NewCampaignMilestone = typeof campaignMilestones.$inferInsert
export type CampaignPayment = typeof campaignPayments.$inferSelect
export type NewCampaignPayment = typeof campaignPayments.$inferInsert
export type CampaignPerformanceRow = typeof campaignPerformance.$inferSelect
export type NewCampaignPerformanceRow = typeof campaignPerformance.$inferInsert
export type InfluencerFollow = typeof influencerFollows.$inferSelect
export type NewInfluencerFollow = typeof influencerFollows.$inferInsert
export type InfluencerReview = typeof influencerReviews.$inferSelect
export type NewInfluencerReview = typeof influencerReviews.$inferInsert
export type CampaignDispute = typeof campaignDisputes.$inferSelect
export type NewCampaignDispute = typeof campaignDisputes.$inferInsert

// ── Content Review Reminders (migration 006) ────────────────────────
export const contentReviewReminders = pgTable('content_review_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),                     // → influencer_content_posts.id
  campaignId: uuid('campaign_id').notNull(),             // → influencer_campaigns.id
  brandId: text('brand_id').notNull(),                   // → users.id
  reminderType: text('reminder_type').notNull()
    .$type<'75_pct' | '90_pct' | 'sla_expired' | 'daily'>(),
  scheduledAt: timestamp('scheduled_at').notNull(),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // UNIQUE (post_id, reminder_type) enforced in migration
})

export type ContentReviewReminder = typeof contentReviewReminders.$inferSelect
export type NewContentReviewReminder = typeof contentReviewReminders.$inferInsert

// ── Campaign Applications (migration 007) ─────────────────────────
export const campaignApplications = pgTable('campaign_applications', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),              // → influencer_campaigns.id
  influencerId: text('influencer_id').notNull(),          // → users.id
  proposalText: text('proposal_text').notNull(),
  proposedRate: integer('proposed_rate').notNull(),        // smallest currency unit (paise)
  proposedCurrency: text('proposed_currency').notNull().default('INR'),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn'>(),
  brandResponse: text('brand_response'),
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
  respondedAt: timestamp('responded_at'),
  // UNIQUE (campaign_id, influencer_id) enforced in migration
})

export type CampaignApplication = typeof campaignApplications.$inferSelect
export type NewCampaignApplication = typeof campaignApplications.$inferInsert

// ════════════════════════════════════════════════════════════════
// SECTION: PAYMENT SYSTEM (migration 008)
// ════════════════════════════════════════════════════════════════

// ── Payout Accounts (influencers + consumers) ───────────────────
export const payoutAccounts = pgTable('influencer_payout_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),                    // → users.id
  userRole: text('user_role').notNull().default('influencer')
    .$type<'influencer' | 'consumer'>(),
  accountType: text('account_type').notNull()
    .$type<'bank_account' | 'upi' | 'paypal' | 'wise' | 'swift'>(),

  // India fields
  accountHolderName: text('account_holder_name'),
  accountNumber: text('account_number'),                // AES-256-GCM encrypted
  ifscCode: text('ifsc_code'),
  upiId: text('upi_id'),

  // International fields
  paypalEmail: text('paypal_email'),
  wiseEmail: text('wise_email'),
  swiftCode: text('swift_code'),
  iban: text('iban'),                                   // AES-256-GCM encrypted
  bankName: text('bank_name'),
  bankCountry: text('bank_country'),

  // Common fields
  currency: text('currency').notNull().default('INR'),
  isPrimary: boolean('is_primary').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(false),
  verifiedAt: timestamp('verified_at'),
  encryptionKeyId: text('encryption_key_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // UNIQUE(user_id, account_type, currency) WHERE is_active = true — enforced in migration
  // INDEX: (user_id, is_primary) — enforced in migration
  // INDEX: (user_id, is_active) — enforced in migration
})

export type PayoutAccount = typeof payoutAccounts.$inferSelect
export type NewPayoutAccount = typeof payoutAccounts.$inferInsert

// ── Razorpay Orders ─────────────────────────────────────────────
export const razorpayOrders = pgTable('razorpay_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull(),            // → influencer_campaigns.id
  milestoneId: uuid('milestone_id'),                    // → campaign_milestones.id (nullable)
  brandId: text('brand_id').notNull(),                  // → users.id
  razorpayOrderId: text('razorpay_order_id').notNull().unique(),
  amount: integer('amount').notNull(),                  // paise/cents
  currency: text('currency').notNull().default('INR'),
  platformFee: integer('platform_fee').notNull().default(0),
  influencerAmount: integer('influencer_amount').notNull().default(0),
  status: text('status').notNull().default('created')
    .$type<'created' | 'attempted' | 'paid' | 'failed' | 'refunded'>(),
  razorpayPaymentId: text('razorpay_payment_id'),
  razorpaySignature: text('razorpay_signature'),
  paymentMethod: text('payment_method'),
  international: boolean('international').notNull().default(false),
  refundAmount: integer('refund_amount').default(0),
  refundId: text('refund_id'),
  refundedAt: timestamp('refunded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // INDEX: (campaign_id) — enforced in migration
  // INDEX: (brand_id, status) — enforced in migration
})

export type RazorpayOrder = typeof razorpayOrders.$inferSelect
export type NewRazorpayOrder = typeof razorpayOrders.$inferInsert

// ── Influencer/Consumer Payouts ─────────────────────────────────
export const influencerPayouts = pgTable('influencer_payouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id'),                      // → influencer_campaigns.id (nullable for reward payouts)
  recipientId: text('recipient_id').notNull(),          // → users.id
  recipientType: text('recipient_type').notNull().default('influencer')
    .$type<'influencer' | 'consumer'>(),
  payoutAccountId: uuid('payout_account_id').notNull(), // → influencer_payout_accounts.id
  amount: integer('amount').notNull(),                  // smallest currency unit
  currency: text('currency').notNull(),
  payoutMethod: text('payout_method').notNull()
    .$type<'razorpay_payout' | 'wise_manual' | 'paypal_manual' | 'bank_manual'>(),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'processing' | 'completed' | 'failed'>(),
  razorpayPayoutId: text('razorpay_payout_id'),
  wiseTransferId: text('wise_transfer_id'),
  failureReason: text('failure_reason'),
  retryCount: integer('retry_count').notNull().default(0),
  initiatedAt: timestamp('initiated_at'),
  completedAt: timestamp('completed_at'),
  adminNote: text('admin_note'),
  processedBy: text('processed_by'),                    // → users.id (admin)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // INDEX: (recipient_id, status) — enforced in migration
  // INDEX: (status) WHERE status = 'pending' — enforced in migration
  // INDEX: (campaign_id) — enforced in migration
})

export type InfluencerPayout = typeof influencerPayouts.$inferSelect
export type NewInfluencerPayout = typeof influencerPayouts.$inferInsert

// ── Payment Reward Redemptions (consumer points → cash/voucher/credits) ──
export const paymentRedemptions = pgTable('payment_redemptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  consumerId: text('consumer_id').notNull(),            // → users.id
  points: integer('points').notNull(),
  value: integer('value').notNull(),                    // paise equivalent
  currency: text('currency').notNull().default('INR'),
  redemptionType: text('redemption_type').notNull()
    .$type<'platform_credits' | 'voucher' | 'cash_payout'>(),
  status: text('status').notNull().default('pending')
    .$type<'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'>(),
  payoutId: uuid('payout_id'),                          // → influencer_payouts.id (for cash payouts)
  voucherCode: text('voucher_code'),
  brandId: text('brand_id'),                            // → users.id (brand funding voucher)
  failureReason: text('failure_reason'),
  processedAt: timestamp('processed_at'),
  adminNote: text('admin_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // INDEX: (consumer_id, status) — enforced in migration
  // INDEX: (status) WHERE status = 'pending' — enforced in migration
})

export type PaymentRedemption = typeof paymentRedemptions.$inferSelect
export type NewPaymentRedemption = typeof paymentRedemptions.$inferInsert

// ════════════════════════════════════════════════════════════════
// SECTION: DEALS DISCOVERY + COMMUNITY (migration 009)
// ════════════════════════════════════════════════════════════════

// ── Deals ────────────────────────────────────────────────────────
export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: text('brand_id').notNull(),
  productId: text('product_id'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  dealType: text('deal_type').notNull(),           // 'promo_code' | 'redirect' | 'percentage_off' | 'fixed_off' | 'bogo' | 'free_shipping'
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }),
  discountCurrency: text('discount_currency').default('INR'),
  promoCode: text('promo_code'),
  redirectUrl: text('redirect_url'),
  originalPrice: integer('original_price'),         // paise
  discountedPrice: integer('discounted_price'),     // paise
  maxRedemptions: integer('max_redemptions'),
  redemptionCount: integer('redemption_count').notNull().default(0),
  validFrom: timestamp('valid_from').defaultNow().notNull(),
  validUntil: timestamp('valid_until'),
  category: text('category'),
  tags: text('tags').array().default([]),
  icpTargetData: jsonb('icp_target_data'),
  status: text('status').notNull().default('draft'),  // 'draft' | 'active' | 'paused' | 'expired'
  isFeatured: boolean('is_featured').notNull().default(false),
  isVerified: boolean('is_verified').notNull().default(true),
  verificationNote: text('verification_note'),
  viewCount: integer('view_count').notNull().default(0),
  saveCount: integer('save_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // search_vector tsvector column managed by DB trigger, not in Drizzle
})

// ── Community Posts ──────────────────────────────────────────────
export const communityDealsPost = pgTable('community_deals_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  authorId: text('author_id').notNull(),
  authorRole: text('author_role').notNull(),        // 'consumer' | 'influencer' | 'brand'
  postType: text('post_type').notNull().default('deal'), // 'deal' | 'review' | 'discussion' | 'alert'
  title: text('title').notNull(),
  body: text('body').notNull(),
  imageUrls: text('image_urls').array().default([]),
  productId: text('product_id'),
  brandId: text('brand_id'),
  dealId: uuid('deal_id'),
  externalUrl: text('external_url'),
  promoCode: text('promo_code'),
  discountDetails: text('discount_details'),
  category: text('category'),
  tags: text('tags').array().default([]),
  upvoteCount: integer('upvote_count').notNull().default(0),
  downvoteCount: integer('downvote_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  saveCount: integer('save_count').notNull().default(0),
  isBrandVerified: boolean('is_brand_verified').notNull().default(false),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at'),
  isSponsored: boolean('is_sponsored').notNull().default(false),
  sponsoredBy: text('sponsored_by'),
  isFeatured: boolean('is_featured').notNull().default(false),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'removed' | 'needs_edit'
  rejectionReason: text('rejection_reason'),
  autoApprovedAt: timestamp('auto_approved_at'),
  moderationNote: text('moderation_note'),
  pointsAwarded: integer('points_awarded').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // search_vector tsvector column managed by DB trigger
})

// ── Community Post Votes ─────────────────────────────────────────
export const communityDealsPostVotes = pgTable('community_deals_post_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  userId: text('user_id').notNull(),
  voteType: text('vote_type').notNull(),            // 'up' | 'down'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // UNIQUE(post_id, user_id) enforced in migration
})

// ── Community Post Saves ─────────────────────────────────────────
export const communityDealsPostSaves = pgTable('community_deals_post_saves', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  userId: text('user_id').notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
  // UNIQUE(post_id, user_id) enforced in migration
})

// ── Community Comments ───────────────────────────────────────────
export const communityDealsComments = pgTable('community_deals_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull(),
  authorId: text('author_id').notNull(),
  authorRole: text('author_role').notNull(),
  parentCommentId: uuid('parent_comment_id'),       // self-ref for threaded comments
  body: text('body').notNull(),
  isBrandVerified: boolean('is_brand_verified').notNull().default(false),
  upvoteCount: integer('upvote_count').notNull().default(0),
  status: text('status').notNull().default('active'), // 'active' | 'removed' | 'flagged'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ── Community Comment Votes ──────────────────────────────────────
export const communityDealsCommentVotes = pgTable('community_deals_comment_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  commentId: uuid('comment_id').notNull(),
  userId: text('user_id').notNull(),
  voteType: text('vote_type').notNull(),            // 'up' | 'down'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  // UNIQUE(comment_id, user_id) enforced in migration
})

// ── Deal Saves ───────────────────────────────────────────────────
export const dealSaves = pgTable('deal_saves', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').notNull(),
  userId: text('user_id').notNull(),
  savedAt: timestamp('saved_at').defaultNow().notNull(),
  // UNIQUE(deal_id, user_id) enforced in migration
})

// ── Deal Redemptions ─────────────────────────────────────────────
export const dealRedemptions = pgTable('deal_redemptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  dealId: uuid('deal_id').notNull(),
  consumerId: text('consumer_id').notNull(),
  redemptionType: text('redemption_type').notNull(), // 'promo_code_copied' | 'redirect_clicked'
  redeemedAt: timestamp('redeemed_at').defaultNow().notNull(),
  pointsAwarded: integer('points_awarded').notNull().default(10),
})

// ── Community Flags ──────────────────────────────────────────────
export const communityDealsFlags = pgTable('community_deals_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentType: text('content_type').notNull(),      // 'post' | 'comment'
  contentId: uuid('content_id').notNull(),
  flaggedBy: text('flagged_by').notNull(),
  reason: text('reason').notNull(),                 // 'spam' | 'fake_deal' | 'inappropriate' | 'duplicate' | 'other'
  details: text('details'),
  status: text('status').notNull().default('pending'), // 'pending' | 'reviewed' | 'dismissed'
  reviewedBy: text('reviewed_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ── Deals + Community Type Exports ───────────────────────────────
export type Deal = typeof deals.$inferSelect
export type NewDeal = typeof deals.$inferInsert
export type CommunityDealsPost = typeof communityDealsPost.$inferSelect
export type NewCommunityDealsPost = typeof communityDealsPost.$inferInsert
export type CommunityDealsComment = typeof communityDealsComments.$inferSelect
export type NewCommunityDealsComment = typeof communityDealsComments.$inferInsert
export type CommunityDealsFlag = typeof communityDealsFlags.$inferSelect
export type DealRedemption = typeof dealRedemptions.$inferSelect
export type NewDealRedemption = typeof dealRedemptions.$inferInsert
