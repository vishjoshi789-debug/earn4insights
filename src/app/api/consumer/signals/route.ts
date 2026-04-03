/**
 * Consumer Signal History API
 *
 * GET /api/consumer/signals
 *   Returns the authenticated consumer's signal snapshots.
 *
 *   Query params:
 *     category  — filter by signal category (behavioral | demographic |
 *                 psychographic | social | sensitive). Omit for all categories.
 *     limit     — max snapshots returned per category (default 20, max 100)
 *     since     — ISO date string — only return snapshots after this date
 *     latestOnly — 'true' to return only the most recent snapshot per category
 *                  (default false)
 *
 * Used by the consumer dashboard's "My Signals" / data transparency page.
 * Consent-gated: only returns signals for categories the consumer has consented to.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getLatestSignalSnapshot,
  getAllLatestSignals,
  getSignalHistory,
  type SignalCategory,
} from '@/db/repositories/signalRepository'
import { hasConsentForCategory } from '@/db/repositories/consentRepository'

const VALID_CATEGORIES: SignalCategory[] = [
  'behavioral',
  'demographic',
  'psychographic',
  'social',
  'sensitive',
]

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl
    const categoryParam = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const sinceParam = searchParams.get('since')
    const latestOnly = searchParams.get('latestOnly') === 'true'
    const since = sinceParam ? new Date(sinceParam) : undefined

    if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as SignalCategory)) {
      return NextResponse.json(
        {
          error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        { status: 400 }
      )
    }

    if (latestOnly) {
      // Return the latest snapshot per category (or for the requested category)
      if (categoryParam) {
        const category = categoryParam as SignalCategory
        const consentOk = await checkSignalConsent(userId, category)
        if (!consentOk) {
          return NextResponse.json({
            category,
            snapshot: null,
            reason: 'consent_not_granted',
          })
        }
        const snapshot = await getLatestSignalSnapshot(userId, category)
        return NextResponse.json({ category, snapshot })
      }

      // All categories
      const allLatest = await getAllLatestSignals(userId)

      // Filter out categories without consent
      const filtered: Record<string, any> = {}
      for (const [cat, snap] of Object.entries(allLatest)) {
        const allowed = await checkSignalConsent(userId, cat as SignalCategory)
        if (allowed) filtered[cat] = snap
      }

      return NextResponse.json({ latest: filtered })
    }

    // History mode
    const categoriesToFetch: SignalCategory[] = categoryParam
      ? [categoryParam as SignalCategory]
      : VALID_CATEGORIES

    const result: Record<string, any> = {}

    for (const category of categoriesToFetch) {
      const allowed = await checkSignalConsent(userId, category)
      if (!allowed) {
        result[category] = { snapshots: [], reason: 'consent_not_granted' }
        continue
      }

      const snapshots = await getSignalHistory(userId, category, { limit, since })
      result[category] = { snapshots }
    }

    return NextResponse.json({ signals: result })
  } catch (error) {
    console.error('[ConsumerSignals GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Map signal category to the consent category required to view it.
 * 'sensitive' signals require any one of the sensitive consent categories —
 * we check 'behavioral' as the baseline since sensitive signals are only
 * generated after explicit sensitive consent is granted at collection time.
 */
async function checkSignalConsent(
  userId: string,
  category: SignalCategory
): Promise<boolean> {
  const consentMap: Record<SignalCategory, Parameters<typeof hasConsentForCategory>[1]> = {
    behavioral: 'behavioral',
    demographic: 'demographic',
    psychographic: 'psychographic',
    social: 'social',
    sensitive: 'behavioral', // sensitive snapshots are only stored if consented at write time
  }
  return hasConsentForCategory(userId, consentMap[category])
}
