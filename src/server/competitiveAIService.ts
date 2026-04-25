import 'server-only'

/**
 * Competitive AI Service
 *
 * Four AI flows powered by OpenAI with Zod-validated inputs and outputs.
 * Follows the existing codebase pattern (see `themeExtractionService`):
 * direct `openai.chat.completions.create` + JSON response + Zod validation.
 * No new dependencies.
 *
 * Model tiers (approved in Q2):
 *   GPT-4o-mini  → daily insights, trend detection, quick actionables
 *   GPT-4o       → weekly deep-dive reports (higher quality, longer context)
 *
 * Cost discipline
 * ───────────────
 * Every call logs tokens + estimated cost via `logAiCall`. The orchestrator
 * (competitiveIntelligenceService) enforces the per-brand daily cap and the
 * 24-hour idempotency window; this module just executes the flows.
 *
 * Privacy
 * ───────
 * Callers pass AGGREGATED inputs only (cohort-gated at repo layer). The
 * prompts explicitly instruct the model never to invent consumer names,
 * brand revenue, or competitor budgets. Output schemas enforce structure
 * and truncate / coerce anything that deviates.
 */

import OpenAI from 'openai'
import { z } from 'zod'

// ── Model config ──────────────────────────────────────────────────

export const AI_MODELS = {
  DAILY: process.env.COMPETITIVE_AI_DAILY_MODEL || 'gpt-4o-mini',
  WEEKLY: process.env.COMPETITIVE_AI_WEEKLY_MODEL || 'gpt-4o',
} as const

// Approximate pricing per 1K tokens (April 2026 rates — update if costs shift).
// Used only for logging; not for billing.
const PRICING_PER_1K_INPUT: Record<string, number> = {
  'gpt-4o-mini': 0.00015,
  'gpt-4o': 0.0025,
}
const PRICING_PER_1K_OUTPUT: Record<string, number> = {
  'gpt-4o-mini': 0.0006,
  'gpt-4o': 0.01,
}

const DEFAULT_TEMPERATURE = 0.2
const MAX_TOKENS_DAILY = 700
const MAX_TOKENS_WEEKLY = 2500

// ── Zod schemas — outputs ──────────────────────────────────────────

const SeverityEnum = z.enum(['critical', 'warning', 'info', 'opportunity'])

export const DailyInsightOutput = z.object({
  title: z.string().min(5).max(140),
  summary: z.string().min(20).max(500),
  severity: SeverityEnum,
  isActionable: z.boolean(),
  actionSuggestion: z.string().max(500).nullable().optional(),
  insightType: z.enum([
    'sentiment_comparison',
    'segment_overlap',
    'pricing_gap',
    'feature_gap',
    'geographic_opportunity',
    'complaint_themes',
    'influencer_activity',
    'deal_comparison',
    'consumer_switching',
    'market_trend',
    'ai_recommendation',
  ]),
})
export type DailyInsight = z.infer<typeof DailyInsightOutput>

export const WeeklyReportOutput = z.object({
  headline: z.string().min(10).max(200),
  executiveSummary: z.string().min(40).max(1200),
  keyFindings: z.array(z.object({
    heading: z.string().min(5).max(140),
    detail: z.string().max(600),
    severity: SeverityEnum,
  })).min(1).max(6),
  recommendations: z.array(z.object({
    action: z.string().min(10).max(280),
    rationale: z.string().max(400),
    priority: z.enum(['high', 'medium', 'low']),
  })).max(5),
  trendNarrative: z.string().max(800).optional(),
})
export type WeeklyReport = z.infer<typeof WeeklyReportOutput>

export const TrendInsightOutput = z.object({
  trendLabel: z.string().min(3).max(80),
  direction: z.enum(['rising', 'falling', 'stable', 'volatile']),
  summary: z.string().max(500),
  confidence: z.enum(['low', 'medium', 'high']),
})
export type TrendInsight = z.infer<typeof TrendInsightOutput>

export const ActionRecommendationOutput = z.object({
  action: z.string().min(10).max(300),
  rationale: z.string().max(500),
  priority: z.enum(['high', 'medium', 'low']),
  expectedImpact: z.string().max(300).optional(),
})
export type ActionRecommendation = z.infer<typeof ActionRecommendationOutput>

// ── Zod schemas — inputs ───────────────────────────────────────────

export const DailyInsightInput = z.object({
  brandId: z.string(),
  brandName: z.string(),
  category: z.string(),
  competitorNames: z.array(z.string()).max(10),
  snapshot: z.object({
    brandSentiment: z.object({
      positive: z.number(), neutral: z.number(), negative: z.number(),
      avgRating: z.number().nullable(), cohortSize: z.number(),
    }).nullable(),
    competitorSentiment: z.object({
      positive: z.number(), neutral: z.number(), negative: z.number(),
      avgRating: z.number().nullable(), cohortSize: z.number(),
    }).nullable(),
    topBrandThemes: z.array(z.object({ category: z.string(), count: z.number() })).max(10),
    topCompetitorThemes: z.array(z.object({ category: z.string(), count: z.number() })).max(10),
    priceGapPct: z.number().nullable(),
    marketSharePct: z.number().nullable(),
    consumerSwitching: z.object({
      toBrand: z.number(),
      toCompetitor: z.number(),
    }).nullable(),
  }),
})
export type DailyInsightSnapshot = z.infer<typeof DailyInsightInput>

export const WeeklyReportInput = z.object({
  brandId: z.string(),
  brandName: z.string(),
  category: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  competitorNames: z.array(z.string()).max(10),
  competitiveScore: z.object({
    score: z.number().nullable(),
    breakdown: z.record(z.object({ score: z.number(), weight: z.number() })),
    rank: z.number(),
    totalInCategory: z.number(),
    trend: z.enum(['improving', 'stable', 'declining']),
    previousScore: z.number().nullable(),
  }),
  benchmarks: z.array(z.object({
    metricName: z.string(),
    brandValue: z.number(),
    categoryAvg: z.number(),
    percentile: z.number().nullable(),
    sampleSize: z.number(),
  })),
  alertsThisPeriod: z.array(z.object({
    alertType: z.string(),
    title: z.string(),
    severity: z.string(),
  })).max(30),
  dailyInsights: z.array(z.object({
    title: z.string(),
    severity: z.string(),
    insightType: z.string(),
  })).max(20),
})
export type WeeklyReportSnapshot = z.infer<typeof WeeklyReportInput>

// ── Cost logging ───────────────────────────────────────────────────

export type AiCallLog = {
  brandId: string
  flow: 'daily_insight' | 'weekly_report' | 'trend_insight' | 'action_recommendation'
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  durationMs: number
  success: boolean
}

function logAiCall(entry: AiCallLog) {
  console.log(
    JSON.stringify({
      event: 'competitive_intelligence.ai_call',
      ...entry,
      timestamp: new Date().toISOString(),
    })
  )
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const inRate = PRICING_PER_1K_INPUT[model] ?? 0
  const outRate = PRICING_PER_1K_OUTPUT[model] ?? 0
  return +((inputTokens / 1000) * inRate + (outputTokens / 1000) * outRate).toFixed(6)
}

// ── Shared client + runner ─────────────────────────────────────────

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey })
}

const SYSTEM_PROMPT = `You are a competitive intelligence analyst for Earn4Insights, a B2B2C consumer insights platform.

RULES:
1. NEVER invent data, numbers, consumer names, brand revenue figures, or competitor budgets.
2. Only use the structured JSON snapshot provided.
3. All insights MUST be aggregate / cohort-based — never reference individual consumers.
4. Treat any "cohortSize" below 5 as "insufficient data" and say so explicitly.
5. Keep titles under 140 characters and summaries under 500 characters unless the schema allows more.
6. Respond with ONLY valid JSON that matches the schema the user describes — no markdown, no prose outside JSON.
7. If the snapshot shows no meaningful competitive signal, return a "market_trend" insight with severity "info" and honestly say the picture is quiet.
8. Action suggestions must be concrete (e.g. "Launch a deal under 10% to match competitor X" — not "Consider doing something").`

async function runJsonFlow<T>(args: {
  brandId: string
  flow: AiCallLog['flow']
  model: string
  maxTokens: number
  userPrompt: string
  schema: z.ZodType<T>
}): Promise<T> {
  const client = getClient()
  const started = Date.now()

  let completion
  try {
    completion = await client.chat.completions.create({
      model: args.model,
      temperature: DEFAULT_TEMPERATURE,
      max_tokens: args.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: args.userPrompt },
      ],
    })
  } catch (err) {
    logAiCall({
      brandId: args.brandId,
      flow: args.flow,
      model: args.model,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      durationMs: Date.now() - started,
      success: false,
    })
    throw err
  }

  const usage = completion.usage
  const inputTokens = usage?.prompt_tokens ?? 0
  const outputTokens = usage?.completion_tokens ?? 0
  logAiCall({
    brandId: args.brandId,
    flow: args.flow,
    model: args.model,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCost(args.model, inputTokens, outputTokens),
    durationMs: Date.now() - started,
    success: true,
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`${args.flow} returned non-JSON: ${raw.slice(0, 200)}`)
  }
  const result = args.schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(
      `${args.flow} output failed schema validation: ${result.error.issues.map((i) => i.path.join('.') + ':' + i.message).join('; ')}`
    )
  }
  return result.data
}

// ── Flow 1: Daily Insight (GPT-4o-mini) ────────────────────────────

export async function runDailyInsightFlow(
  input: DailyInsightSnapshot
): Promise<DailyInsight> {
  DailyInsightInput.parse(input)

  const userPrompt = `Generate ONE competitive insight for brand "${input.brandName}" in category "${input.category}".

Tracked competitors: ${input.competitorNames.join(', ') || 'none'}

Snapshot (aggregated, cohort-gated):
${JSON.stringify(input.snapshot, null, 2)}

Return JSON matching this schema:
{
  "title": "short headline, <140 chars",
  "summary": "what happened and why it matters, 20–500 chars",
  "severity": "critical | warning | info | opportunity",
  "isActionable": boolean,
  "actionSuggestion": "concrete next step or null",
  "insightType": "sentiment_comparison | segment_overlap | pricing_gap | feature_gap | geographic_opportunity | complaint_themes | influencer_activity | deal_comparison | consumer_switching | market_trend | ai_recommendation"
}

Pick the SINGLE most impactful finding. If the snapshot is thin, say so honestly with severity=info and insightType=market_trend.`

  return runJsonFlow({
    brandId: input.brandId,
    flow: 'daily_insight',
    model: AI_MODELS.DAILY,
    maxTokens: MAX_TOKENS_DAILY,
    userPrompt,
    schema: DailyInsightOutput,
  })
}

// ── Flow 2: Weekly Report (GPT-4o) ─────────────────────────────────

export async function runWeeklyReportFlow(
  input: WeeklyReportSnapshot
): Promise<WeeklyReport> {
  WeeklyReportInput.parse(input)

  const userPrompt = `Generate a weekly competitive intelligence report for brand "${input.brandName}" in category "${input.category}".

Period: ${input.period.start} → ${input.period.end}
Tracked competitors: ${input.competitorNames.join(', ') || 'none'}

Competitive score snapshot:
${JSON.stringify(input.competitiveScore, null, 2)}

Benchmarks:
${JSON.stringify(input.benchmarks, null, 2)}

Alerts fired this period (${input.alertsThisPeriod.length}):
${JSON.stringify(input.alertsThisPeriod, null, 2)}

Daily insights accumulated this period (${input.dailyInsights.length}):
${JSON.stringify(input.dailyInsights, null, 2)}

Return JSON:
{
  "headline": "one-line narrative for the week",
  "executiveSummary": "2–4 sentence overview",
  "keyFindings": [ { "heading": "...", "detail": "...", "severity": "critical|warning|info|opportunity" } ],
  "recommendations": [ { "action": "...", "rationale": "...", "priority": "high|medium|low" } ],
  "trendNarrative": "optional longer-form narrative"
}

Rules:
- 1–6 key findings
- At most 5 recommendations
- Every recommendation must be concrete and tied to a finding
- If competitiveScore.score is null or effectiveWeight is very low, say "insufficient data" in executiveSummary.`

  return runJsonFlow({
    brandId: input.brandId,
    flow: 'weekly_report',
    model: AI_MODELS.WEEKLY,
    maxTokens: MAX_TOKENS_WEEKLY,
    userPrompt,
    schema: WeeklyReportOutput,
  })
}

// ── Flow 3: Trend Insight (GPT-4o-mini) ────────────────────────────

export async function runTrendInsightFlow(input: {
  brandId: string
  category: string
  sentimentTrend: Array<{ periodStart: string; positive: number; neutral: number; negative: number; cohortSize: number }>
}): Promise<TrendInsight> {
  const userPrompt = `Analyze this category sentiment trend for "${input.category}". Return a concise trend summary.

Data (weekly, cohort-gated):
${JSON.stringify(input.sentimentTrend, null, 2)}

Return JSON:
{
  "trendLabel": "short label e.g. 'sentiment declining'",
  "direction": "rising | falling | stable | volatile",
  "summary": "what the trend tells us, <500 chars",
  "confidence": "low | medium | high"
}

Confidence=low if fewer than 3 weeks of data or cohort sizes are small. Confidence=high only with 6+ weeks and consistent direction.`

  return runJsonFlow({
    brandId: input.brandId,
    flow: 'trend_insight',
    model: AI_MODELS.DAILY,
    maxTokens: MAX_TOKENS_DAILY,
    userPrompt,
    schema: TrendInsightOutput,
  })
}

// ── Flow 4: Action Recommendation (GPT-4o-mini) ────────────────────

export async function runActionRecommendationFlow(input: {
  brandId: string
  insightTitle: string
  insightSummary: string
  context?: Record<string, unknown>
}): Promise<ActionRecommendation> {
  const userPrompt = `Given this insight, produce ONE concrete, prioritised action for the brand.

Insight title: ${input.insightTitle}
Insight summary: ${input.insightSummary}
Additional context: ${input.context ? JSON.stringify(input.context) : 'none'}

Return JSON:
{
  "action": "concrete step, <300 chars",
  "rationale": "why this action fits the insight, <500 chars",
  "priority": "high | medium | low",
  "expectedImpact": "optional — what metric should move"
}`

  return runJsonFlow({
    brandId: input.brandId,
    flow: 'action_recommendation',
    model: AI_MODELS.DAILY,
    maxTokens: MAX_TOKENS_DAILY,
    userPrompt,
    schema: ActionRecommendationOutput,
  })
}
