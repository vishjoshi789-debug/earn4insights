import { pgTable, text, timestamp, jsonb, boolean, integer, real, uuid } from 'drizzle-orm/pg-core'

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
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type UserEvent = typeof userEvents.$inferSelect
export type NewUserEvent = typeof userEvents.$inferInsert
export type NotificationQueue = typeof notificationQueue.$inferSelect
export type NewNotificationQueue = typeof notificationQueue.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
