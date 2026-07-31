/**
 * Verification for the feedback CSV export.
 *
 * Exercises the real data path — repository query + filter parsing + CSV
 * builder — against production data, WITHOUT the auth wrapper (which needs a
 * request context). Read-only: SELECTs only.
 *
 * Checks:
 *   1. unfiltered export produces rows
 *   2. filters actually narrow the result (and the SQL path works)
 *   3. a single-day date range is NOT empty (the bug that hit the survey export)
 *   4. NO Blob/storage URL appears anywhere in the output
 *   5. CSV escaping survives commas / quotes / newlines in feedback text
 *
 * Run: dotenv -e .env.local -- tsx scripts/verify-feedback-export.ts
 */

import { db } from '@/db'
import { feedback, products } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import {
  getFeedbackByProduct,
  getMediaForFeedbackIds,
} from '@/db/repositories/feedbackRepository'
import { parseFeedbackFilters } from '@/lib/feedback/filterParams'
import { buildFeedbackCsv, FEEDBACK_CSV_HEADERS } from '@/lib/feedback/feedbackCsv'

let failures = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

async function run() {
  // Pick the product with the most feedback so the checks have data.
  const rows = await db
    .select({ productId: feedback.productId })
    .from(feedback)
    .orderBy(desc(feedback.createdAt))
    .limit(200)

  if (rows.length === 0) {
    console.log('No feedback in the database — cannot verify.')
    return
  }

  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.productId, (counts.get(r.productId) || 0) + 1)
  // Optional argv override so the media-count path can be exercised against a
  // product that actually has attachments.
  const productId = process.argv[2] || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]

  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)

  console.log(`\n=== feedback export verification ===`)
  console.log(`product: ${product?.name ?? productId} (${productId})\n`)

  // 1. Unfiltered
  const all = await getFeedbackByProduct(productId, { limit: 10000 })
  const allMedia = await getMediaForFeedbackIds(all.map((i) => i.id))
  const csv = buildFeedbackCsv(all, allMedia)
  const lines = csv.split('\n')

  console.log('[1] unfiltered export')
  check('produces rows', all.length > 0, `${all.length} rows`)
  check('header row correct', lines[0] === FEEDBACK_CSV_HEADERS.join(','))
  check(
    'column count consistent',
    lines.every((l) => splitCsvLine(l).length === FEEDBACK_CSV_HEADERS.length),
    `${FEEDBACK_CSV_HEADERS.length} cols`
  )

  // 2. Filters narrow
  console.log('\n[2] filters')
  const posFilters = parseFeedbackFilters({ sentiment: 'positive' })
  const positive = await getFeedbackByProduct(productId, { ...posFilters, limit: 10000 })
  check(
    'sentiment filter applies in SQL',
    positive.length <= all.length && positive.every((i) => i.sentiment === 'positive'),
    `${positive.length}/${all.length} positive`
  )

  const audioFilters = parseFeedbackFilters({ modality: 'audio' })
  const audio = await getFeedbackByProduct(productId, { ...audioFilters, limit: 10000 })
  check(
    'modality filter applies in SQL',
    audio.every((i) => i.modalityPrimary === 'audio'),
    `${audio.length} audio`
  )

  const bogus = parseFeedbackFilters({ sentiment: 'not-a-sentiment' })
  check('invalid enum is dropped, not passed to SQL', bogus.sentiment === undefined)

  // 3. Single-day range must not be empty (the survey-export bug)
  console.log('\n[3] single-day date range (regression guard)')
  const newest = all[0]
  const day = new Date(newest.createdAt).toISOString().slice(0, 10)
  const dayFilters = parseFeedbackFilters({ dateFrom: day, dateTo: day })
  const sameDay = await getFeedbackByProduct(productId, { ...dayFilters, limit: 10000 })
  check(
    `dateFrom=dateTo=${day} returns the rows from that day`,
    sameDay.length > 0,
    `${sameDay.length} rows`
  )
  check(
    'dateTo widened to end-of-day',
    (dayFilters.dateTo?.getHours() ?? 0) === 23
  )

  // 4. No storage URLs leak into the CSV
  console.log('\n[4] media URL exclusion (post-incident guard)')
  const urlLike = /https?:\/\/[^\s,"]+/g
  const urls = csv.match(urlLike) || []
  const blobUrls = urls.filter((u) => /blob\.vercel-storage\.com|feedback-media/.test(u))
  check('no Blob storage URLs in CSV', blobUrls.length === 0, `${urls.length} URL-ish strings, ${blobUrls.length} blob`)
  const mediaRows = [...allMedia.values()].flat()
  check(
    'media presence still reported as counts',
    mediaRows.length === 0 || csv.includes('Audio Count'),
    `${mediaRows.length} media rows on this product`
  )

  // 5. Escaping
  console.log('\n[5] CSV escaping')
  const tricky = all.filter((i) => /[",\n]/.test(i.feedbackText))
  check(
    'rows containing , " or newline are quoted',
    tricky.length === 0 ||
      tricky.every((i) => {
        const idx = all.indexOf(i)
        return splitCsvLine(lines[idx + 1]).length === FEEDBACK_CSV_HEADERS.length
      }),
    `${tricky.length} tricky rows`
  )

  console.log('\n--- sample (header + first row, truncated) ---')
  console.log(lines[0])
  if (lines[1]) console.log(lines[1].slice(0, 220) + (lines[1].length > 220 ? '…' : ''))

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
  if (failures > 0) process.exitCode = 1
}

/** Minimal RFC4180 splitter, good enough to count columns. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') inQuotes = false
      else cur += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

run()
  .catch((err) => {
    console.error('Fatal:', err)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))
