import OpenAI from 'openai'
import { db } from '@/db'
import { contributionEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * AI-Driven Quality Scoring Service
 *
 * Evaluates contributions on six dimensions:
 *   relevance, depth, clarity, novelty, actionability, authenticity
 * Uses OpenAI to produce a 0–100 quality_score + sub-scores.
 * Falls back to heuristic scoring when the API key is absent.
 */

// ── Types ─────────────────────────────────────────────────────────
export interface QualityScoreResult {
  qualityScore: number        // 0-100 overall
  relevanceScore: number      // is it meaningful?
  depthScore: number          // insightful vs shallow
  clarityScore: number        // structured + understandable
  noveltyScore: number        // unique / non-duplicate
  actionabilityScore: number  // can product team use this?
  authenticityScore: number   // not spam / bot / low-effort
  reasoning: string           // human-readable explanation
}

interface ScoringInput {
  rawContent: string
  contributionType: string
  productContext?: string
  brandPriorityKeywords?: string[]
  userHistorySummary?: string // e.g. "15 past contributions, avg quality 72"
}

// ── Heuristic fallback scoring ─────────────────────────────────
function heuristicScore(input: ScoringInput): QualityScoreResult {
  const text = input.rawContent || ''
  const words = text.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const uniqueWords = new Set(words.map(w => w.toLowerCase()))
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)

  // Depth: longer + more sentences = deeper
  const depthScore = Math.min(100, Math.round(
    (Math.min(wordCount, 200) / 200) * 60 +
    (Math.min(sentences.length, 10) / 10) * 40
  ))

  // Clarity: reasonable sentence length, punctuation present
  const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : wordCount
  const clarityScore = Math.min(100, Math.round(
    (avgWordsPerSentence >= 5 && avgWordsPerSentence <= 25 ? 70 : 40) +
    (text.includes('.') || text.includes('!') || text.includes('?') ? 20 : 0) +
    (text.length > 50 ? 10 : 0)
  ))

  // Novelty: vocabulary richness
  const richness = wordCount > 0 ? uniqueWords.size / wordCount : 0
  const noveltyScore = Math.min(100, Math.round(richness * 130))

  // Authenticity: not repetitive, not too short
  const maxWordFreq = words.length > 0
    ? Math.max(...Object.values(words.reduce((acc: Record<string, number>, w) => {
        const k = w.toLowerCase(); acc[k] = (acc[k] || 0) + 1; return acc
      }, {})))
    : 0
  const spamRatio = wordCount > 0 ? maxWordFreq / wordCount : 0
  const authenticityScore = Math.min(100, Math.round(
    (spamRatio < 0.3 ? 80 : spamRatio < 0.5 ? 50 : 20) +
    (wordCount >= 10 ? 20 : wordCount >= 5 ? 10 : 0)
  ))

  // Relevance: check keyword overlap with brand priorities
  let relevanceScore = 50 // default mid-range
  if (input.brandPriorityKeywords?.length) {
    const textLower = text.toLowerCase()
    const hits = input.brandPriorityKeywords.filter(k => textLower.includes(k.toLowerCase()))
    relevanceScore = Math.min(100, 40 + Math.round((hits.length / input.brandPriorityKeywords.length) * 60))
  }

  // Actionability: presence of specific/constructive language
  const actionWords = ['should', 'could', 'would', 'suggest', 'improve', 'add', 'fix', 'change', 'feature', 'option', 'bug', 'issue', 'request', 'need', 'want']
  const actionHits = actionWords.filter(w => text.toLowerCase().includes(w))
  const actionabilityScore = Math.min(100, 30 + Math.round((actionHits.length / 5) * 70))

  // Overall: weighted average
  const qualityScore = Math.round(
    relevanceScore * 0.20 +
    depthScore * 0.20 +
    clarityScore * 0.15 +
    noveltyScore * 0.15 +
    actionabilityScore * 0.15 +
    authenticityScore * 0.15
  )

  return {
    qualityScore,
    relevanceScore,
    depthScore,
    clarityScore,
    noveltyScore,
    actionabilityScore,
    authenticityScore,
    reasoning: `Heuristic: ${wordCount} words, ${sentences.length} sentences, ${uniqueWords.size} unique words, ${actionHits.length} action terms`,
  }
}

// ── AI scoring via OpenAI ──────────────────────────────────────
async function aiScore(input: ScoringInput): Promise<QualityScoreResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return heuristicScore(input)

  const model = process.env.OPENAI_SCORING_MODEL || process.env.OPENAI_THEME_MODEL || 'gpt-4o-mini'

  const systemPrompt = `You are a contribution quality evaluator for a product feedback platform.
Score the following user contribution on six dimensions (each 0-100):
1. relevance: Is it meaningful to the product/brand?
2. depth: Is it insightful vs shallow/generic?
3. clarity: Is it well-structured and understandable?
4. novelty: Is it unique, not just repeating obvious points?
5. actionability: Can a product team act on this feedback?
6. authenticity: Is it genuine (not spam, bot, or low-effort)?

Also provide an overall quality_score (0-100) as a weighted combination.
Respond ONLY with valid JSON, no markdown wrapping:
{"quality_score":N,"relevance":N,"depth":N,"clarity":N,"novelty":N,"actionability":N,"authenticity":N,"reasoning":"brief explanation"}`

  const userPrompt = [
    `Contribution type: ${input.contributionType}`,
    input.productContext ? `Product context: ${input.productContext}` : '',
    input.brandPriorityKeywords?.length ? `Brand priorities: ${input.brandPriorityKeywords.join(', ')}` : '',
    input.userHistorySummary ? `User history: ${input.userHistorySummary}` : '',
    `\nContent:\n${input.rawContent.slice(0, 3000)}`,
  ].filter(Boolean).join('\n')

  try {
    const openai = new OpenAI({ apiKey })
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 300,
    })

    const raw = completion.choices[0]?.message?.content?.trim() || ''
    const parsed = JSON.parse(raw)

    return {
      qualityScore: clamp(parsed.quality_score ?? 50),
      relevanceScore: clamp(parsed.relevance ?? 50),
      depthScore: clamp(parsed.depth ?? 50),
      clarityScore: clamp(parsed.clarity ?? 50),
      noveltyScore: clamp(parsed.novelty ?? 50),
      actionabilityScore: clamp(parsed.actionability ?? 50),
      authenticityScore: clamp(parsed.authenticity ?? 50),
      reasoning: String(parsed.reasoning || 'AI scored').slice(0, 500),
    }
  } catch (err) {
    console.error('[AI Scoring] OpenAI call failed, falling back to heuristics:', err)
    return heuristicScore(input)
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

// ── Public API ────────────────────────────────────────────────
export async function scoreContribution(input: ScoringInput): Promise<QualityScoreResult> {
  return aiScore(input)
}

/**
 * Score a contribution event by its ID and persist the results.
 * This is the main entry point used by the contribution pipeline.
 */
export async function scoreAndPersist(
  eventId: string,
  input: ScoringInput,
): Promise<QualityScoreResult> {
  const result = await scoreContribution(input)

  await db
    .update(contributionEvents)
    .set({
      qualityScore: result.qualityScore,
      qualityReasoning: result.reasoning,
      relevanceScore: result.relevanceScore,
      depthScore: result.depthScore,
      clarityScore: result.clarityScore,
      noveltyScore: result.noveltyScore,
      actionabilityScore: result.actionabilityScore,
      authenticityScore: result.authenticityScore,
      scoredAt: new Date(),
      status: result.authenticityScore < 20 ? 'flagged' : 'scored',
    })
    .where(eq(contributionEvents.id, eventId))

  return result
}
