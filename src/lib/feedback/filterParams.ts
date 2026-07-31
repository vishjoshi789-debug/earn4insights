import type { FeedbackFilters } from '@/db/repositories/feedbackRepository'

/**
 * Query-string shape for the brand-facing feedback list.
 */
export type FeedbackSearchParams = {
  dateFrom?: string
  dateTo?: string
  ratingMin?: string
  ratingMax?: string
  sentiment?: string
  modality?: string
  status?: string
  language?: string
}

/**
 * Parse the filter query string into repository filters.
 *
 * SINGLE SOURCE OF TRUTH — the page and the CSV export MUST both call this.
 * When the two had separate filter logic on the survey side, they drifted: the
 * page widened `dateTo` to end-of-day but the export didn't, so a single-day
 * range showed rows on screen and exported an empty file. Keep one function.
 *
 * Values are validated against known enums rather than passed through, so a
 * hand-edited URL can't inject an arbitrary value into the WHERE clause.
 * Invalid or empty params are dropped (treated as "no filter").
 */
export function parseFeedbackFilters(sp: FeedbackSearchParams): FeedbackFilters {
  const oneOf = (value: string | undefined, allowed: string[]) =>
    value && allowed.includes(value) ? value : undefined

  const toRating = (value: string | undefined) => {
    const n = Number(value)
    return value && Number.isFinite(n) ? Math.min(5, Math.max(1, Math.trunc(n))) : undefined
  }

  const toDate = (value: string | undefined, endOfDay = false) => {
    if (!value) return undefined
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return undefined
    // A date input yields midnight; widen the upper bound so a single-day
    // range includes that whole day instead of returning nothing.
    if (endOfDay) d.setHours(23, 59, 59, 999)
    return d
  }

  return {
    sentiment: oneOf(sp.sentiment, ['positive', 'neutral', 'negative']),
    modality: oneOf(sp.modality, ['text', 'audio', 'video', 'mixed']),
    status: oneOf(sp.status, ['new', 'reviewed', 'addressed']),
    language: sp.language || undefined,
    ratingMin: toRating(sp.ratingMin),
    ratingMax: toRating(sp.ratingMax),
    dateFrom: toDate(sp.dateFrom),
    dateTo: toDate(sp.dateTo, true),
  }
}
