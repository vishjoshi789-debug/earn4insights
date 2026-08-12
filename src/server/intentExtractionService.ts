/**
 * Intent Extraction Service — Phase 1A
 *
 * After every feedback submission or survey response, extract simple intent
 * signals from the text using keyword/pattern matching (no AI cost).
 *
 * These signals are written to consumer_intents and can be used for:
 * - Watchlist matching (user wants feature X → brand releases feature X → notify)
 * - Brand alerts (frustration spike, high purchase intent)
 * - Personalization engine enhancement (intent-aware scoring)
 */

import { db } from '@/db'
import { consumerIntents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { checkConsent } from '@/lib/consent-enforcement'

// ── Intent Patterns ────────────────────────────────────────────────
// Each pattern maps a regex to an intent type + confidence modifier.
// Patterns are ordered from most to least specific.

interface IntentPattern {
  regex: RegExp
  intentType: string
  baseConfidence: number
  extractGroup?: number  // which regex group holds the "desired thing"
}

const INTENT_PATTERNS: IntentPattern[] = [
  // ── Purchase intent ─────────────────────────────────────────────
  {
    regex: /\b(will buy|want to buy|ready to (buy|purchase)|take my money|shut up and take|would (definitely )?pay|instant (buy|purchase))\b/i,
    intentType: 'purchase_ready',
    baseConfidence: 0.85,
  },
  {
    regex: /\b(considering (buying|purchasing)|might buy|thinking about (buying|getting)|on my (wish ?list|radar))\b/i,
    intentType: 'purchase_ready',
    baseConfidence: 0.6,
  },

  // ── Feature desire ──────────────────────────────────────────────
  {
    regex: /\b(wish (?:it|this|they) (?:had|supported|included|offered)|(?:need|want|waiting for|dying for|hoping for)[\s:]+(.{3,60}?)(?:\.|!|$))/i,
    intentType: 'want_feature',
    baseConfidence: 0.75,
    extractGroup: 2,
  },
  {
    regex: /\b(would (?:love|like|appreciate) (?:to see|if (?:it|they) (?:add|added|had)))[\s:]+(.{3,60}?)(?:\.|!|$)/i,
    intentType: 'want_feature',
    baseConfidence: 0.7,
    extractGroup: 2,
  },
  {
    regex: /\b(please add|feature request|suggestion|missing feature)[\s:]+(.{3,60}?)(?:\.|!|$)/i,
    intentType: 'want_feature',
    baseConfidence: 0.8,
    extractGroup: 2,
  },

  // ── Product desire / launch waiting ─────────────────────────────
  {
    regex: /\b(waiting for (?:this|it) to launch|can'?t wait (?:for|until)|when (?:will|does|is) (?:this|it) (?:launch|release|come out|ship))\b/i,
    intentType: 'want_product',
    baseConfidence: 0.85,
  },
  {
    regex: /\b(need this (?:product|app|tool)|this would solve|exactly what i (?:need|was looking for))\b/i,
    intentType: 'want_product',
    baseConfidence: 0.7,
  },

  // ── Frustration ─────────────────────────────────────────────────
  {
    regex: /\b(terrible|awful|worst|horrible|unusable|broken|doesn'?t work|waste of (?:time|money)|complete garbage|never (?:again|using this)|uninstall)\b/i,
    intentType: 'frustrated',
    baseConfidence: 0.85,
  },
  {
    regex: /\b(frustrat|disappoint|annoy|irritat|infuriat|fed up|sick of|bugs? (?:everywhere|all over|constant))/i,
    intentType: 'frustrated',
    baseConfidence: 0.7,
  },
  {
    regex: /\b(not (?:great|good|happy|satisfied|impressed)|could be (?:much |a lot )?better|needs (?:a lot of |serious )?work)\b/i,
    intentType: 'frustrated',
    baseConfidence: 0.5,
  },

  // ── Price sensitivity ───────────────────────────────────────────
  {
    regex: /\b(too expensive|overpriced|not worth (?:the )?(?:price|cost|money)|cheaper alternative|price is (?:too )?high|can'?t afford)\b/i,
    intentType: 'price_sensitive',
    baseConfidence: 0.8,
  },
  {
    regex: /\b(free (?:version|tier|plan|trial)|discount|coupon|promo|sale price|budget (?:friendly|option))\b/i,
    intentType: 'price_sensitive',
    baseConfidence: 0.55,
  },

  // ── Churn risk ──────────────────────────────────────────────────
  {
    regex: /\b(switch(?:ing|ed)? to|moving to|cancel(?:l?ing|l?ed)? (?:my )?(?:subscription|account|plan)|looking for alternative|leaving)\b/i,
    intentType: 'churning',
    baseConfidence: 0.85,
  },
]

// ── Core Extraction ────────────────────────────────────────────────

export interface ExtractedIntent {
  intentType: string
  extractedText: string
  confidence: number
}

/**
 * Extract intent signals from free text.
 * Returns all matching intents, deduplicated by intentType (highest confidence wins).
 */
export function extractIntents(text: string): ExtractedIntent[] {
  if (!text || text.trim().length < 5) return []

  const raw: ExtractedIntent[] = []

  for (const pattern of INTENT_PATTERNS) {
    const match = text.match(pattern.regex)
    if (!match) continue

    const extractedText =
      pattern.extractGroup && match[pattern.extractGroup]
        ? match[pattern.extractGroup].trim()
        : match[0].trim()

    raw.push({
      intentType: pattern.intentType,
      extractedText: extractedText.substring(0, 200), // cap length
      confidence: pattern.baseConfidence,
    })
  }

  // Deduplicate by intentType — keep highest confidence
  const byType = new Map<string, ExtractedIntent>()
  for (const intent of raw) {
    const existing = byType.get(intent.intentType)
    if (!existing || intent.confidence > existing.confidence) {
      byType.set(intent.intentType, intent)
    }
  }

  return Array.from(byType.values())
}

// ── Persistence ────────────────────────────────────────────────────

/**
 * Extract intents from text and persist to consumer_intents table.
 * Called after feedback submission or survey response.
 *
 * ── CONSENT CHOKEPOINT (added 2026-08-12) ─────────────────────────────────
 * Deriving commercial/psychological state ("this person is churning", "this
 * person is price-sensitive") from someone's words is INFERENCE — new
 * processing about them, not a copy of what they wrote. That is squarely what
 * DPDP scopes, and it had no consent check at all.
 *
 * Gated here rather than at the call sites, deliberately: this is the single
 * point where inference becomes a stored fact, so a future third caller is
 * covered automatically. `segmentedAnalytics` had the same hole and was fixed
 * the same way — and the lesson there applies here too: **k-anonymity did not
 * establish a lawful purpose, and neither does "the brand can already read
 * the feedback."** Reading what someone wrote and inferring their intent from
 * it are different processing.
 *
 * ⚠️ This also gates the BRAND ALERT. `alertOnHighIntent` fires from the
 * feedback route only over the array this function returns, and that array is
 * empty without consent — so the consumer's VERBATIM phrase
 * ("A consumer expressed churning: '<their words>'") can never reach a brand
 * on inferred grounds they didn't agree to. Do not bypass this by calling
 * `extractIntents()` directly and alerting on the result.
 *
 * Denial is a SILENT SKIP, not an error: a consumer who declined behavioural
 * processing has done something normal, and their feedback must still save.
 */
export async function extractAndPersistIntents(params: {
  userId: string
  text: string
  productId?: string
  categorySlug?: string
  sourceType: 'feedback' | 'survey' | 'watchlist'
  sourceId: string
}) {
  const { userId, text, productId, categorySlug, sourceType, sourceId } = params

  // No identity, no inference. `consumer_intents.user_id` is NOT NULL with an
  // FK to users.id (migration 031), so '' or an email is a guaranteed
  // violation — the defect that made the survey path fail silently for months.
  if (!userId) return []

  // `collect_behavioral_signals` → ['behavioral'] (consent-enforcement.ts:136).
  // The category already existed and nothing used it.
  const { allowed } = await checkConsent(userId, 'behavioral')
  if (!allowed) return []

  const intents = extractIntents(text)
  if (intents.length === 0) return []

  const rows = intents.map((intent) => ({
    userId,
    productId: productId || null,
    categorySlug: categorySlug || null,
    intentType: intent.intentType,
    extractedText: intent.extractedText,
    confidence: intent.confidence,
    sourceType,
    sourceId,
  }))

  const inserted = await db.insert(consumerIntents).values(rows).returning()
  return inserted
}

/**
 * Get all intents for a consumer (for personalization engine).
 */
export async function getConsumerIntents(userId: string) {
  return db
    .select()
    .from(consumerIntents)
    .where(eq(consumerIntents.userId, userId))
    .orderBy(consumerIntents.createdAt)
}
