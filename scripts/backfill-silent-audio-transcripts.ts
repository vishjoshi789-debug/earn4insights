/**
 * Backfill: remove Whisper's fabricated transcripts from silent recordings and
 * restore the analytics fields they clobbered.
 *
 * BACKGROUND
 * ----------
 * Four production recordings contained digital silence (Opus DTX floor, ~1.7
 * kbps). Whisper does not return empty text for silence — it hallucinates stock
 * phrases, and every one transcribed to "you".
 *
 * That value did not just land in `transcript_text`. Media processing also
 * writes `normalized_text`, which is the field sentiment analysis and the CSV
 * export actually read — so the consumer's REAL written feedback was
 * overwritten by a hallucinated word, and sentiment was scored from "you"
 * instead of what they wrote.
 *
 * WHAT THIS DOES (founder-approved "Option A")
 *   1. transcript_text -> NULL           (fabricated; there was no speech)
 *   2. normalized_text -> feedback_text  (restore the real written feedback)
 *   3. sentiment       -> recomputed from feedback_text
 *
 * `feedback_text` itself is never touched — it always held the genuine text.
 *
 * Idempotent: only rows whose transcript still matches a known hallucination
 * are considered, so re-running does nothing.
 *
 * Run:
 *   dotenv -e .env.local -- tsx scripts/backfill-silent-audio-transcripts.ts --dry-run
 *   dotenv -e .env.local -- tsx scripts/backfill-silent-audio-transcripts.ts
 */

import { db } from '@/db'
import { feedback } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { analyzeSentiment } from '@/server/sentimentService'

const DRY_RUN = process.argv.includes('--dry-run')

// Mirrors WHISPER_SILENCE_HALLUCINATIONS in feedbackMediaProcessingService.ts.
const HALLUCINATIONS = new Set([
  'you', 'thank you', 'thanks', 'thanks for watching', 'thank you for watching',
  'thank you very much', 'bye', 'okay', 'ok', 'so', 'the', 'yeah', 'mm', 'mhm', 'uh', 'um',
])

function isHallucination(text: string | null): boolean {
  if (!text) return false
  const n = text.toLowerCase().replace(/[.,!?;:'"()\[\]—–-]/g, '').replace(/\s+/g, ' ').trim()
  return HALLUCINATIONS.has(n)
}

async function run() {
  const rows = await db
    .select({
      id: feedback.id,
      userEmail: feedback.userEmail,
      feedbackText: feedback.feedbackText,
      transcriptText: feedback.transcriptText,
      normalizedText: feedback.normalizedText,
      sentiment: feedback.sentiment,
    })
    .from(feedback)

  const affected = rows.filter((r) => isHallucination(r.transcriptText))

  console.log(`\n=== silent-audio transcript backfill ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'} ===`)
  console.log(`scanned ${rows.length} feedback rows · ${affected.length} affected\n`)

  if (affected.length === 0) {
    console.log('Nothing to do.\n')
    return
  }

  let updated = 0
  for (const r of affected) {
    // Recompute sentiment from the REAL written feedback, not the hallucination.
    let newSentiment = r.sentiment
    try {
      const s = await analyzeSentiment(r.feedbackText)
      newSentiment = s.sentiment
    } catch (err) {
      console.warn(`  WARN ${r.id}: sentiment recompute failed, leaving as-is (${(err as Error).message})`)
    }

    console.log(`  ${r.id}  (${r.userEmail})`)
    console.log(`    transcript_text : ${JSON.stringify(r.transcriptText)} -> NULL`)
    console.log(`    normalized_text : ${JSON.stringify(r.normalizedText)} -> ${JSON.stringify(r.feedbackText.slice(0, 60))}${r.feedbackText.length > 60 ? '…' : ''}`)
    console.log(`    sentiment       : ${r.sentiment} -> ${newSentiment}${newSentiment === r.sentiment ? ' (unchanged)' : ''}`)

    if (!DRY_RUN) {
      await db
        .update(feedback)
        .set({
          transcriptText: null,
          transcriptConfidence: null,
          normalizedText: r.feedbackText,
          sentiment: newSentiment,
        })
        .where(eq(feedback.id, r.id))
      updated++
    }
    console.log()
  }

  console.log(`--- ${DRY_RUN ? `${affected.length} row(s) would be updated` : `${updated} row(s) updated`} ---\n`)
}

run()
  .catch((err) => {
    console.error('Fatal:', err)
    process.exitCode = 1
  })
  .finally(() => process.exit(process.exitCode ?? 0))
