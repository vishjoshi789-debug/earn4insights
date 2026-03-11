/**
 * Runtime Zod validators for JSONB fields stored in the database.
 * These schemas validate data BEFORE insertion — they do NOT change
 * the database schema itself.
 *
 * Usage: call .safeParse(data) to validate without throwing,
 *        or .parse(data) to throw on invalid input.
 */
import { z } from 'zod'

// ── User Demographics ──────────────────────────────────────────
export const demographicsSchema = z.object({
  gender: z.string().max(50).optional(),
  ageRange: z.string().max(20).optional(),
  location: z.string().max(100).optional(),
  language: z.string().max(10).optional(),
  education: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  incomeRange: z.string().max(50).optional(),
}).passthrough()

// ── User Interests ─────────────────────────────────────────────
export const interestsSchema = z.object({
  productCategories: z.array(z.string().max(100)).max(50).optional(),
  topics: z.array(z.string().max(100)).max(50).optional(),
}).passthrough()

// ── Notification Preferences ───────────────────────────────────
const channelPrefsSchema = z.object({
  enabled: z.boolean(),
  frequency: z.string().max(20).optional(),
  quietHours: z.object({
    start: z.string().max(10).optional(),
    end: z.string().max(10).optional(),
  }).optional(),
}).passthrough()

export const notificationPreferencesSchema = z.object({
  email: channelPrefsSchema.optional(),
  whatsapp: channelPrefsSchema.optional(),
  sms: channelPrefsSchema.optional(),
}).passthrough()

// ── User Consent ───────────────────────────────────────────────
export const consentSchema = z.object({
  tracking: z.boolean().optional(),
  personalization: z.boolean().optional(),
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  grantedAt: z.string().optional(),
}).passthrough()

// ── Product Profile ────────────────────────────────────────────
export const productProfileSchema = z.object({
  category: z.string().max(100).optional(),
  categoryName: z.string().max(200).optional(),
  website: z.string().max(500).optional(),
}).passthrough()

// ── Survey Questions ───────────────────────────────────────────
export const surveyQuestionSchema = z.object({
  id: z.string().max(100),
  text: z.string().max(2000),
  type: z.string().max(50),
}).passthrough()

export const surveyQuestionsSchema = z.array(surveyQuestionSchema).max(100)

// ── Feedback Metadata ──────────────────────────────────────────
export const feedbackMetadataSchema = z.record(z.string(), z.unknown()).optional()

// ── Analytics Event Data ───────────────────────────────────────
export const eventDataSchema = z.record(z.string(), z.unknown()).optional()

/**
 * Safely validate data, returning the parsed result or null.
 * Never throws — logs a warning on invalid data.
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context: string
): T | null {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.warn(`[Validation] Invalid ${context}:`, result.error.issues.slice(0, 3))
    return null
  }
  return result.data
}
