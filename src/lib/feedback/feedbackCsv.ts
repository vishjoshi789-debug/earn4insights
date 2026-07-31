import type { FeedbackItem, MediaItem } from '@/db/repositories/feedbackRepository'

/**
 * Pure CSV builder for the brand-facing feedback export.
 *
 * Lives outside the `'use server'` action deliberately: that file can only
 * export async functions, which would make this untestable and force every
 * check through an authenticated request. Here it's a plain function that can
 * be exercised directly against real rows.
 *
 * DELIBERATELY OMITS MEDIA URLs. `feedback_media.storage_key` is a public,
 * unauthenticated Vercel Blob URL (see the incident record in SESSION_RESUME);
 * putting those in a downloadable file would re-publish exactly what the
 * 2026-07-31 rotation destroyed, in a form that can never be revoked. The CSV
 * reports which media EXISTS (counts per type) plus the transcript text, which
 * is the analysable content anyway. Media stays behind the ownership-checked
 * proxy.
 */

export const FEEDBACK_CSV_HEADERS = [
  'Feedback ID',
  'Submitted At',
  'User Name',
  'User Email',
  'Rating',
  'Sentiment',
  'Category',
  'Status',
  'Modality',
  'Original Language',
  'Normalized Language',
  'Feedback Text',
  'Normalized Text',
  'Transcript',
  'Audio Count',
  'Video Count',
  'Image Count',
] as const

/** RFC4180-ish escaping: double the quotes, wrap when the value needs it. */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str === '') return ''
  const escaped = str.replace(/"/g, '""')
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped
}

export function buildFeedbackCsv(
  items: FeedbackItem[],
  mediaMap: Map<string, MediaItem[]>
): string {
  const rows = items.map((item) => {
    const media = mediaMap.get(item.id) || []
    const count = (type: string) => media.filter((m) => m.mediaType === type).length

    return [
      item.id,
      new Date(item.createdAt).toISOString(),
      item.userName,
      item.userEmail,
      item.rating,
      item.sentiment,
      item.category,
      item.status,
      item.modalityPrimary,
      item.originalLanguage,
      item.normalizedLanguage,
      item.feedbackText,
      // Only emit the translation when it differs, so the column carries
      // signal rather than duplicating Feedback Text on every English row.
      item.normalizedText && item.normalizedText !== item.feedbackText
        ? item.normalizedText
        : '',
      item.transcriptText,
      count('audio'),
      count('video'),
      count('image'),
    ]
      .map(csvField)
      .join(',')
  })

  return [FEEDBACK_CSV_HEADERS.join(','), ...rows].join('\n')
}
