/**
 * Consumer Consent API
 *
 * GET  /api/consumer/consent
 *   Returns all consent records for the authenticated consumer.
 *   Used by the consent dashboard to show current per-category status.
 *
 * POST /api/consumer/consent
 *   Grant consent for a data category.
 *   Body: { dataCategory, purpose, consentVersion, legalBasis? }
 *   Sensitive categories (sensitive_*) always use legalBasis='explicit_consent'.
 *
 * DELETE /api/consumer/consent?category=<dataCategory>
 *   Revoke consent for a data category.
 *   For sensitive categories: also soft-deletes all stored sensitive attributes.
 *   Marks icp_match_scores stale for this consumer so they are recomputed.
 *
 * GDPR basis:
 *   Art. 7  — proof of consent (grantedAt, consentVersion, IP, UA stored)
 *   Art. 9  — explicit consent required for sensitive_* categories
 *   Art. 17 — right to erasure (revocation cascades to sensitive attributes)
 *
 * India DPDP Act 2023:
 *   §6  — notice + consent before collection
 *   §12 — right to withdraw consent at any time
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getAllConsents,
  grantConsent,
  revokeConsent,
  type ConsentDataCategory,
  type GrantConsentInput,
} from '@/db/repositories/consentRepository'
import { isSensitiveCategory } from '@/lib/consent-enforcement'

// ── Helpers ───────────────────────────────────────────────────────

async function getAuthenticatedUserId(): Promise<string | null> {
  const session = await auth()
  if (!session?.user?.email) return null
  const userId = (session.user as any).id
  return userId ?? null
}

const VALID_CATEGORIES = new Set<ConsentDataCategory>([
  'behavioral', 'demographic', 'psychographic', 'social',
  'sensitive_health', 'sensitive_dietary', 'sensitive_religion', 'sensitive_caste',
  'tracking', 'personalization', 'analytics', 'marketing',
])

function isValidCategory(cat: string): cat is ConsentDataCategory {
  return VALID_CATEGORIES.has(cat as ConsentDataCategory)
}

// ── GET — list all consent records ───────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const records = await getAllConsents(userId)

    // Shape for the consumer dashboard: show category, status, timestamps
    const consents = records.map((r) => ({
      dataCategory: r.dataCategory,
      granted: r.granted,
      grantedAt: r.grantedAt,
      revokedAt: r.revokedAt,
      consentVersion: r.consentVersion,
      purpose: r.purpose,
      legalBasis: r.legalBasis,
      isSensitive: isSensitiveCategory(r.dataCategory as ConsentDataCategory),
    }))

    // Also surface categories that have never had a record (all VALID_CATEGORIES)
    const recordedCategories = new Set(records.map((r) => r.dataCategory))
    const missingCategories = [...VALID_CATEGORIES].filter(
      (cat) => !recordedCategories.has(cat)
    )
    const unconsented = missingCategories.map((cat) => ({
      dataCategory: cat,
      granted: false,
      grantedAt: null,
      revokedAt: null,
      consentVersion: null,
      purpose: null,
      legalBasis: null,
      isSensitive: isSensitiveCategory(cat),
    }))

    return NextResponse.json({
      consents: [...consents, ...unconsented],
      total: VALID_CATEGORIES.size,
      granted: consents.filter((c) => c.granted && !c.revokedAt).length,
    })
  } catch (error) {
    console.error('[ConsumerConsent GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST — grant consent ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { dataCategory, purpose, consentVersion, legalBasis } = body

    if (!dataCategory || !isValidCategory(dataCategory)) {
      return NextResponse.json(
        { error: `Invalid or missing dataCategory. Must be one of: ${[...VALID_CATEGORIES].join(', ')}` },
        { status: 400 }
      )
    }

    if (!purpose || typeof purpose !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: purpose (string describing why this data is collected)' },
        { status: 400 }
      )
    }

    if (!consentVersion || typeof consentVersion !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: consentVersion (e.g. "v2.1")' },
        { status: 400 }
      )
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      undefined

    const input: GrantConsentInput = {
      purpose,
      consentVersion,
      // sensitive_* categories must always use explicit_consent (enforced in repository too)
      legalBasis: isSensitiveCategory(dataCategory)
        ? 'explicit_consent'
        : legalBasis ?? 'explicit_consent',
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    }

    const record = await grantConsent(userId, dataCategory, input)

    return NextResponse.json({
      success: true,
      consent: {
        dataCategory: record.dataCategory,
        granted: record.granted,
        grantedAt: record.grantedAt,
        consentVersion: record.consentVersion,
        legalBasis: record.legalBasis,
        isSensitive: isSensitiveCategory(dataCategory),
      },
    })
  } catch (error) {
    console.error('[ConsumerConsent POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE — revoke consent ───────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')

    if (!category || !isValidCategory(category)) {
      return NextResponse.json(
        { error: `Invalid or missing ?category=. Must be one of: ${[...VALID_CATEGORIES].join(', ')}` },
        { status: 400 }
      )
    }

    const record = await revokeConsent(userId, category)

    if (!record) {
      return NextResponse.json(
        { error: `No consent record found for category "${category}"` },
        { status: 404 }
      )
    }

    // If sensitive category: soft-delete associated sensitive attributes
    // Use sensitiveAttributeService which handles the ConsentDataCategory →
    // SensitiveAttributeCategory mapping (e.g. 'sensitive_health' → 'health').
    if (isSensitiveCategory(category)) {
      try {
        const { removeSensitiveAttribute } = await import(
          '@/server/sensitiveAttributeService'
        )
        await removeSensitiveAttribute(userId, category)
      } catch (err) {
        // Log but don't fail the revocation — the consent is already revoked
        console.error(
          `[ConsumerConsent DELETE] Failed to soft-delete sensitive attributes for ${userId}/${category}:`,
          err
        )
      }
    }

    // Mark ICP match scores stale so they are recomputed without this category
    try {
      const { markScoresStaleByConsumer } = await import(
        '@/db/repositories/icpRepository'
      )
      await markScoresStaleByConsumer(userId)
    } catch (err) {
      console.error(
        `[ConsumerConsent DELETE] Failed to mark ICP scores stale for ${userId}:`,
        err
      )
    }

    return NextResponse.json({
      success: true,
      revoked: {
        dataCategory: record.dataCategory,
        revokedAt: record.revokedAt,
        isSensitive: isSensitiveCategory(category),
      },
    })
  } catch (error) {
    console.error('[ConsumerConsent DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
