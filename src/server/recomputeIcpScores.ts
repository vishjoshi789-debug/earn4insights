/**
 * Recompute ICP Match Scores — Daily Cron Job
 *
 * Re-scores all stale icp_match_scores rows and fires 'icp_match' alerts
 * for consumers that newly cross an ICP's matchThreshold.
 *
 * Called by: GET /api/cron/recompute-icp-scores (Vercel Cron, daily at 03:00 UTC)
 * Runs AFTER update-consumer-signals (02:30) so fresh signal snapshots are available.
 *
 * Per-stale-score logic:
 *   1. Load ICP — skip if deleted/inactive.
 *   2. Score the consumer against the ICP via scoreConsumerForIcp().
 *   3. If the consumer's NEW score >= icp.matchThreshold and OLD score was below
 *      (or didn't exist) → fire alertOnIcpMatch() for the brand.
 *   4. Upsert the refreshed score (persist=true is handled inside scoreConsumerForIcp).
 *
 * Batch cap: ICP_SCORE_CRON_BATCH_SIZE env var (default: 200 stale rows per run).
 */

import 'server-only'

import { getStaleScores, getIcpById } from '@/db/repositories/icpRepository'
import { scoreConsumerForIcp } from '@/server/icpMatchScoringService'
import { alertOnIcpMatch } from '@/server/brandAlertService'

export type IcpScoreCronResult = {
  startedAt: string
  completedAt: string
  staleScoresFound: number
  recomputed: number
  errored: number
  newMatches: number   // consumers that newly crossed the threshold
  details: Array<{
    icpId: string
    consumerId: string
    oldScore: number | null
    newScore: number
    crossed: boolean
    error?: string
  }>
}

/**
 * Run the daily ICP score recomputation batch.
 */
export async function runRecomputeIcpScores(): Promise<IcpScoreCronResult> {
  const startedAt = new Date().toISOString()

  const batchSize = parseInt(process.env.ICP_SCORE_CRON_BATCH_SIZE ?? '200')
  const staleRows = await getStaleScores({ limit: batchSize })

  const staleScoresFound = staleRows.length
  let recomputed = 0
  let errored = 0
  let newMatches = 0

  const details: IcpScoreCronResult['details'] = []

  for (const staleRow of staleRows) {
    const { icpId, consumerId, matchScore: oldScore } = staleRow

    try {
      // Load ICP — might have been deactivated since the score was cached
      const icp = await getIcpById(icpId)
      if (!icp || !icp.isActive) {
        details.push({ icpId, consumerId, oldScore, newScore: 0, crossed: false })
        continue
      }

      // Recompute — this upserts the fresh score in icp_match_scores
      const result = await scoreConsumerForIcp(icpId, consumerId, true)
      const newScore = result.matchScore
      recomputed++

      // Did the consumer newly cross the threshold?
      const wasBelowThreshold = oldScore < icp.matchThreshold
      const isNowAboveThreshold = newScore >= icp.matchThreshold
      const crossed = wasBelowThreshold && isNowAboveThreshold

      if (crossed) {
        newMatches++
        // Fire the ICP match alert — non-blocking, error doesn't abort the batch
        alertOnIcpMatch({
          brandId: icp.brandId,
          productId: icp.productId ?? undefined,
          consumerId,
          icpId,
          icpName: icp.name,
          matchScore: newScore,
          breakdown: result.breakdown,
        }).catch((err) =>
          console.error(
            `[IcpScoreCron] alertOnIcpMatch failed icp=${icpId} consumer=${consumerId}:`,
            err
          )
        )
      }

      details.push({ icpId, consumerId, oldScore, newScore, crossed })
    } catch (err) {
      errored++
      details.push({
        icpId,
        consumerId,
        oldScore,
        newScore: 0,
        crossed: false,
        error: err instanceof Error ? err.message : String(err),
      })
      console.error(
        `[IcpScoreCron] Error recomputing icp=${icpId} consumer=${consumerId}:`,
        err
      )
    }
  }

  const completedAt = new Date().toISOString()

  console.log(
    `[IcpScoreCron] Done. found=${staleScoresFound} recomputed=${recomputed} ` +
      `errored=${errored} newMatches=${newMatches}`
  )

  return {
    startedAt,
    completedAt,
    staleScoresFound,
    recomputed,
    errored,
    newMatches,
    details,
  }
}
