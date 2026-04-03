import 'server-only'

import { db } from '@/db'
import {
  consentRecords,
  userProfiles,
  type ConsentRecord,
  type NewConsentRecord,
} from '@/db/schema'
import { eq, and, lt, isNotNull, sql } from 'drizzle-orm'
import { logSensitiveDataAccess } from '@/lib/audit-log'

// ── Types ─────────────────────────────────────────────────────────

export type ConsentDataCategory =
  // Standard categories
  | 'behavioral'
  | 'demographic'
  | 'psychographic'
  | 'social'
  // Special categories (GDPR Art. 9 / DPDP sensitive personal data)
  | 'sensitive_health'
  | 'sensitive_dietary'
  | 'sensitive_religion'
  | 'sensitive_caste'
  // Legacy categories (migrated from userProfiles.consent JSONB)
  | 'tracking'
  | 'personalization'
  | 'analytics'
  | 'marketing'

export type GrantConsentInput = {
  purpose: string
  legalBasis?: 'explicit_consent' | 'legitimate_interest' | 'contract'
  consentVersion: string
  ipAddress?: string
  userAgent?: string
}

// Legacy consent JSONB shape from userProfiles.consent
type LegacyConsent = {
  tracking?: boolean
  personalization?: boolean
  analytics?: boolean
  marketing?: boolean
  grantedAt?: string
}

// ── Queries ───────────────────────────────────────────────────────

/**
 * Get a single consent record for a user + category.
 * Returns null if no record exists (treat as not consented).
 */
export async function getConsent(
  userId: string,
  dataCategory: ConsentDataCategory
): Promise<ConsentRecord | null> {
  const rows = await db
    .select()
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.dataCategory, dataCategory)
      )
    )
    .limit(1)

  return rows[0] ?? null
}

/**
 * Get all consent records for a user, across all categories.
 * Used for GDPR Art. 15 right-of-access and the consumer consent dashboard.
 */
export async function getAllConsents(userId: string): Promise<ConsentRecord[]> {
  return db
    .select()
    .from(consentRecords)
    .where(eq(consentRecords.userId, userId))
}

/**
 * Check whether a user has actively granted consent for a category.
 * Returns false if no record exists or if consent was revoked.
 */
export async function hasConsentForCategory(
  userId: string,
  dataCategory: ConsentDataCategory
): Promise<boolean> {
  const record = await getConsent(userId, dataCategory)
  if (!record) return false
  if (!record.granted) return false
  if (record.revokedAt) return false
  return true
}

// ── Mutations ─────────────────────────────────────────────────────

/**
 * Grant consent for a data category.
 * Creates the record if it doesn't exist; updates it if it does.
 * Records the exact policy version, IP, and user agent at time of grant.
 */
export async function grantConsent(
  userId: string,
  dataCategory: ConsentDataCategory,
  input: GrantConsentInput
): Promise<ConsentRecord> {
  const now = new Date()

  // sensitive_* categories must use explicit_consent
  const legalBasis = dataCategory.startsWith('sensitive_')
    ? 'explicit_consent'
    : (input.legalBasis ?? 'explicit_consent')

  const [record] = await db
    .insert(consentRecords)
    .values({
      userId,
      dataCategory,
      purpose: input.purpose,
      legalBasis,
      granted: true,
      grantedAt: now,
      revokedAt: null,
      consentVersion: input.consentVersion,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    } satisfies Omit<NewConsentRecord, 'id' | 'createdAt' | 'updatedAt'>)
    .onConflictDoUpdate({
      target: [consentRecords.userId, consentRecords.dataCategory],
      set: {
        granted: true,
        grantedAt: now,
        revokedAt: null,
        purpose: input.purpose,
        legalBasis,
        consentVersion: input.consentVersion,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        updatedAt: now,
      },
    })
    .returning()

  await logSensitiveDataAccess(userId, 'system', 'CONSENT_GRANTED', {
    dataCategory,
    consentVersion: input.consentVersion,
    legalBasis,
  }).catch(console.error)

  return record
}

/**
 * Revoke consent for a data category.
 * Sets revokedAt and granted=false on the existing record.
 * Does nothing if no record exists or consent was already revoked.
 *
 * IMPORTANT: Callers must also:
 *   - Delete consumer_sensitive_attributes rows linked to this consent
 *   - Mark icp_match_scores stale for this consumer
 */
export async function revokeConsent(
  userId: string,
  dataCategory: ConsentDataCategory
): Promise<ConsentRecord | null> {
  const now = new Date()

  const rows = await db
    .update(consentRecords)
    .set({
      granted: false,
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(consentRecords.userId, userId),
        eq(consentRecords.dataCategory, dataCategory)
      )
    )
    .returning()

  if (rows[0]) {
    await logSensitiveDataAccess(userId, 'system', 'CONSENT_REVOKED', {
      dataCategory,
    }).catch(console.error)
  }

  return rows[0] ?? null
}

// ── IP/UA Anonymization (GDPR data minimisation) ─────────────────

/**
 * Anonymize IP addresses and user agents on revoked consent records
 * older than the retention period (default: 3 years / 1095 days).
 *
 * GDPR Art. 5(1)(e) — storage limitation. IP/UA are only needed for
 * proof-of-consent while consent is active. After revocation + retention
 * period, they must be minimised.
 *
 * Called by the daily signal cron (updateConsumerSignals).
 * Returns the number of rows anonymized.
 */
export async function anonymizeExpiredConsentMetadata(
  retentionDays = 1095
): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const result = await db
    .update(consentRecords)
    .set({
      ipAddress: null,
      userAgent: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(consentRecords.granted, false),
        isNotNull(consentRecords.revokedAt),
        lt(consentRecords.revokedAt, cutoff),
        // Only update rows that still have IP or UA data
        sql`(${consentRecords.ipAddress} IS NOT NULL OR ${consentRecords.userAgent} IS NOT NULL)`
      )
    )
    .returning({ id: consentRecords.id })

  return result.length
}

// ── Legacy Migration ──────────────────────────────────────────────

/**
 * Migrate one user's legacy userProfiles.consent JSONB to consent_records rows.
 * Called once per user — idempotent (uses onConflictDoNothing).
 *
 * Legacy mapping:
 *   tracking       → dataCategory='tracking'
 *   personalization → dataCategory='personalization'
 *   analytics      → dataCategory='analytics'
 *   marketing      → dataCategory='marketing'
 */
export async function migrateLegacyConsent(
  userId: string,
  legacyConsent: LegacyConsent
): Promise<void> {
  const legacyCategories: ConsentDataCategory[] = [
    'tracking',
    'personalization',
    'analytics',
    'marketing',
  ]

  const legacyPurposes: Record<string, string> = {
    tracking: 'Tracking your on-platform activity to improve recommendations',
    personalization: 'Personalising product recommendations based on your profile',
    analytics: 'Analysing your usage patterns to improve the platform',
    marketing: 'Sending you marketing communications about relevant products',
  }

  const grantedAt = legacyConsent.grantedAt
    ? new Date(legacyConsent.grantedAt)
    : new Date('2024-01-01') // safe fallback for records with no timestamp

  const rows: NewConsentRecord[] = legacyCategories.map((cat) => ({
    userId,
    dataCategory: cat,
    purpose: legacyPurposes[cat],
    legalBasis: 'explicit_consent' as const,
    granted: !!(legacyConsent as Record<string, any>)[cat],
    grantedAt: !!(legacyConsent as Record<string, any>)[cat] ? grantedAt : null,
    revokedAt: null,
    consentVersion: 'legacy-v1.0',
    ipAddress: null,
    userAgent: null,
  }))

  await db
    .insert(consentRecords)
    .values(rows)
    .onConflictDoNothing()
    // onConflictDoNothing: if the row already exists (migration re-run), skip it.
    // This makes the function safe to call multiple times.
}

/**
 * Migrate ALL users' legacy consent records in batches.
 * Reads from userProfiles.consent JSONB → writes to consent_records.
 *
 * Run once after deploying migration 002. Safe to re-run (idempotent).
 * Returns the number of users processed.
 */
export async function migrateAllLegacyConsents(): Promise<{ processed: number; skipped: number }> {
  const profiles = await db
    .select({ id: userProfiles.id, consent: userProfiles.consent })
    .from(userProfiles)

  let processed = 0
  let skipped = 0

  for (const profile of profiles) {
    if (!profile.consent) {
      skipped++
      continue
    }

    try {
      await migrateLegacyConsent(profile.id, profile.consent as LegacyConsent)
      processed++
    } catch (err) {
      console.error(`[consentRepository] Failed to migrate consent for user ${profile.id}:`, err)
      skipped++
    }
  }

  return { processed, skipped }
}
