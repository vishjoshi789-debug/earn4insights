/**
 * GDPR Art. 15 — Right of Access
 * GET /api/consumer/my-data
 *
 * Returns a complete portable snapshot of all personal data the platform
 * holds for the authenticated consumer. Covers:
 *
 *   profile          — email, demographics, interests, notification prefs
 *   consent          — all consent records (category, status, timestamps)
 *   signals          — latest signal snapshot per category (behavioral, demographic,
 *                      psychographic, social)
 *   signal_history   — up to 500 historical snapshots (date-sorted)
 *   sensitive        — categories stored (listed by name — NOT decrypted, see §below)
 *   icp_scores       — all cached ICP match scores for this consumer
 *
 * Sensitive data: listed by category only (not decrypted in this endpoint).
 * Full decryption export requires a separate DSAR flow with identity
 * verification — that is out of scope for this endpoint.
 *
 * India DPDP Act 2023 §11: Right to access data and information.
 * GDPR Art. 15: Right of access by the data subject.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getUserProfile } from '@/db/repositories/userProfileRepository'
import { getAllConsents } from '@/db/repositories/consentRepository'
import {
  getAllLatestSignals,
  getAllSignalHistory,
} from '@/db/repositories/signalRepository'
import { listSensitiveAttributeCategories } from '@/db/repositories/sensitiveAttributeRepository'
import { db } from '@/db'
import { icpMatchScores } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all data in parallel
    const [
      profile,
      consents,
      latestSignals,
      signalHistory,
      sensitiveCategories,
      icpScores,
    ] = await Promise.all([
      getUserProfile(userId),
      getAllConsents(userId),
      getAllLatestSignals(userId),
      getAllSignalHistory(userId, { limit: 500 }),
      listSensitiveAttributeCategories(userId),
      db
        .select()
        .from(icpMatchScores)
        .where(eq(icpMatchScores.consumerId, userId)),
    ])

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Strip internal fields from profile before returning
    const { id: _id, ...profileRest } = profile as any

    const responseData = {
      exportedAt: new Date().toISOString(),
      userId,
      legalBasis: {
        gdpr: 'Art. 15 — Right of access by the data subject',
        dpdp: 'India DPDP Act 2023 §11 — Right to access data',
      },

      profile: {
        email: profile.email,
        demographics: profile.demographics,
        interests: profile.interests,
        notificationPreferences: profile.notificationPreferences,
        onboardingComplete: (profileRest as any).onboardingComplete ?? null,
        createdAt: (profileRest as any).createdAt ?? null,
        updatedAt: profile.updatedAt,
        lastSignalComputedAt: (profile as any).lastSignalComputedAt ?? null,
      },

      consent: consents.map((c) => ({
        dataCategory: c.dataCategory,
        granted: c.granted,
        grantedAt: c.grantedAt,
        revokedAt: c.revokedAt,
        purpose: c.purpose,
        legalBasis: c.legalBasis,
        consentVersion: c.consentVersion,
      })),

      signals: {
        latest: Object.fromEntries(
          Object.entries(latestSignals).map(([cat, snap]) => [
            cat,
            {
              signals: snap?.signals,
              snapshotAt: snap?.snapshotAt,
              triggeredBy: snap?.triggeredBy,
              schemaVersion: snap?.schemaVersion,
            },
          ])
        ),
        history: signalHistory.map((s) => ({
          signalCategory: s.signalCategory,
          snapshotAt: s.snapshotAt,
          triggeredBy: s.triggeredBy,
          signals: s.signals,
        })),
        totalSnapshots: signalHistory.length,
      },

      sensitiveData: {
        note:
          'Sensitive personal data is stored encrypted. Categories stored are listed below. ' +
          'To receive a decrypted copy, submit a formal Data Subject Access Request (DSAR).',
        storedCategories: sensitiveCategories,
      },

      icpMatchScores: icpScores.map((s) => ({
        icpId: s.icpId,
        matchScore: s.matchScore,
        computedAt: s.computedAt,
        isStale: s.isStale,
        consentGaps: (s.breakdown as any)?.consentGaps ?? [],
        explainability: (s.breakdown as any)?.explainability ?? null,
      })),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('[ConsumerMyData GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
