/**
 * Sensitive Attribute Service
 *
 * Service layer for reading and writing GDPR Art. 9 / DPDP sensitive personal data.
 * All operations are consent-gated — the relevant sensitive_* consent category must
 * be actively granted before any read or write is allowed.
 *
 * Consent category → attribute category mapping:
 *   sensitive_health    → health
 *   sensitive_dietary   → dietary
 *   sensitive_religion  → religion
 *   sensitive_caste     → caste
 *
 * This service:
 *   1. Checks consent before every operation (throws on denied)
 *   2. Delegates to sensitiveAttributeRepository for encryption + storage
 *   3. Logs all access via logSensitiveDataAccess (in the repository)
 *
 * Callers (API routes, cron) should use THIS service, not the repository directly,
 * so that consent enforcement is always applied consistently.
 */

import 'server-only'

import {
  getConsent,
  hasConsentForCategory,
  type ConsentDataCategory,
} from '@/db/repositories/consentRepository'
import {
  getSensitiveAttributeRow,
  decryptSensitiveAttribute,
  listSensitiveAttributeCategories,
  upsertSensitiveAttribute,
  softDeleteSensitiveAttribute,
  softDeleteAllSensitiveAttributesForUser,
  type SensitiveAttributeCategory,
  type SensitiveAttributePayload,
} from '@/db/repositories/sensitiveAttributeRepository'

// ── Consent ↔ Attribute mapping ───────────────────────────────────

const CONSENT_TO_ATTRIBUTE: Record<string, SensitiveAttributeCategory> = {
  sensitive_health: 'health',
  sensitive_dietary: 'dietary',
  sensitive_religion: 'religion',
  sensitive_caste: 'caste',
}

const ATTRIBUTE_TO_CONSENT: Record<SensitiveAttributeCategory, ConsentDataCategory> = {
  health: 'sensitive_health',
  dietary: 'sensitive_dietary',
  religion: 'sensitive_religion',
  caste: 'sensitive_caste',
}

/**
 * Map a consent category like 'sensitive_health' to its attribute category 'health'.
 * Throws if the category is not a recognised sensitive category.
 */
function consentCategoryToAttributeCategory(
  consentCategory: string
): SensitiveAttributeCategory {
  const mapped = CONSENT_TO_ATTRIBUTE[consentCategory]
  if (!mapped) {
    throw new Error(
      `"${consentCategory}" is not a sensitive consent category. ` +
        `Valid values: ${Object.keys(CONSENT_TO_ATTRIBUTE).join(', ')}`
    )
  }
  return mapped
}

// ── Reads ─────────────────────────────────────────────────────────

/**
 * Check whether a user has stored data for a sensitive category.
 * Returns false if consent not granted or no data stored.
 * Does NOT decrypt or log — use for existence checks only.
 */
export async function hasSensitiveAttribute(
  userId: string,
  consentCategory: ConsentDataCategory
): Promise<boolean> {
  const attributeCategory = consentCategoryToAttributeCategory(consentCategory)
  const allowed = await hasConsentForCategory(userId, consentCategory)
  if (!allowed) return false

  const row = await getSensitiveAttributeRow(userId, attributeCategory)
  return row !== null
}

/**
 * Retrieve and decrypt a sensitive attribute for a user.
 *
 * Requires active consent for the relevant sensitive_* category.
 * Returns null if:
 *   - Consent not granted (does NOT throw — callers should use for optional enrichment)
 *   - No data has been stored yet
 *
 * @param userId          - The user whose attribute to read
 * @param consentCategory - e.g. 'sensitive_health', 'sensitive_dietary'
 * @param accessedBy      - Who is accessing (userId, 'system', 'cron', etc.) for audit log
 */
export async function getSensitiveAttribute(
  userId: string,
  consentCategory: ConsentDataCategory,
  accessedBy: string = 'system'
): Promise<SensitiveAttributePayload | null> {
  const allowed = await hasConsentForCategory(userId, consentCategory)
  if (!allowed) return null

  const attributeCategory = consentCategoryToAttributeCategory(consentCategory)
  return decryptSensitiveAttribute(userId, attributeCategory, accessedBy)
}

/**
 * List the sensitive categories the user has stored data for (metadata only).
 * Used for GDPR Art. 15 right-of-access responses.
 *
 * Returns consent category names (e.g. 'sensitive_health'), not attribute categories.
 * Does not check consent — listing what *exists* is part of the right of access.
 */
export async function listStoredSensitiveCategories(
  userId: string
): Promise<ConsentDataCategory[]> {
  const attributeCategories = await listSensitiveAttributeCategories(userId)
  return attributeCategories.map((cat) => ATTRIBUTE_TO_CONSENT[cat])
}

/**
 * Get all sensitive attributes a user has stored, across all categories.
 * Decrypts and returns each one. Skips categories where consent has been revoked.
 *
 * Used for GDPR Art. 15 full data export.
 */
export async function getAllSensitiveAttributes(
  userId: string,
  accessedBy: string = 'system'
): Promise<Partial<Record<ConsentDataCategory, SensitiveAttributePayload>>> {
  const attributeCategories = await listSensitiveAttributeCategories(userId)
  const result: Partial<Record<ConsentDataCategory, SensitiveAttributePayload>> = {}

  for (const attributeCategory of attributeCategories) {
    const consentCategory = ATTRIBUTE_TO_CONSENT[attributeCategory]
    const allowed = await hasConsentForCategory(userId, consentCategory)
    if (!allowed) continue

    const payload = await decryptSensitiveAttribute(userId, attributeCategory, accessedBy)
    if (payload) {
      result[consentCategory] = payload
    }
  }

  return result
}

// ── Writes ────────────────────────────────────────────────────────

/**
 * Store or update a sensitive attribute for a user.
 *
 * Requires active consent for the relevant sensitive_* category — throws
 * ConsentDeniedError if consent has not been granted or was revoked.
 *
 * The consentRecordId is looked up automatically from the active consent record.
 *
 * @param userId          - The user whose attribute to store
 * @param consentCategory - e.g. 'sensitive_health', 'sensitive_dietary'
 * @param payload         - The attribute data (must match the category's shape)
 */
export async function storeSensitiveAttribute(
  userId: string,
  consentCategory: ConsentDataCategory,
  payload: Omit<SensitiveAttributePayload, 'category'>
): Promise<void> {
  const consentRecord = await getConsent(userId, consentCategory)

  if (!consentRecord || !consentRecord.granted || consentRecord.revokedAt) {
    throw new ConsentDeniedError(
      `User ${userId} has not granted consent for "${consentCategory}". ` +
        `Cannot store sensitive attribute.`
    )
  }

  const attributeCategory = consentCategoryToAttributeCategory(consentCategory)

  await upsertSensitiveAttribute(
    userId,
    attributeCategory,
    payload,
    consentRecord.id
  )
}

// ── Deletion ──────────────────────────────────────────────────────

/**
 * Soft-delete a single sensitive attribute for a user.
 *
 * Called when:
 *   - User explicitly removes a specific sensitive data entry
 *   - Consent revocation cascade (from /api/consumer/consent DELETE)
 *
 * Does NOT revoke the consent record — that is the caller's responsibility.
 */
export async function removeSensitiveAttribute(
  userId: string,
  consentCategory: ConsentDataCategory
): Promise<void> {
  const attributeCategory = consentCategoryToAttributeCategory(consentCategory)
  await softDeleteSensitiveAttribute(userId, attributeCategory)
}

/**
 * Soft-delete ALL sensitive attributes for a user (GDPR/DPDP full erasure).
 *
 * Physical deletion is scheduled automatically after PHYSICAL_DELETION_DELAY_DAYS
 * by the GDPR erasure cron job.
 *
 * Returns the number of rows soft-deleted.
 */
export async function removeAllSensitiveAttributes(userId: string): Promise<number> {
  return softDeleteAllSensitiveAttributesForUser(userId)
}

// ── Errors ────────────────────────────────────────────────────────

export class ConsentDeniedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConsentDeniedError'
  }
}
