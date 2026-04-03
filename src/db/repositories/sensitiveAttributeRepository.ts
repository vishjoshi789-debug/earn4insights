import 'server-only'

import { db } from '@/db'
import {
  consumerSensitiveAttributes,
  type ConsumerSensitiveAttribute,
  type NewConsumerSensitiveAttribute,
} from '@/db/schema'
import { eq, and, isNull, lt } from 'drizzle-orm'
import { encryptForStorage, decryptFromStorage, reEncryptWithNewKey } from '@/lib/encryption'
import { logSensitiveDataAccess } from '@/lib/audit-log'

// ── Types ─────────────────────────────────────────────────────────

export type SensitiveAttributeCategory = 'religion' | 'caste' | 'dietary' | 'health'

// Plaintext shapes per category — stored encrypted, never raw
export type SensitiveAttributePayload =
  | { category: 'religion'; faith: string; practices?: string[] }
  | { category: 'caste'; community: string }
  | { category: 'dietary'; preferences: string[]; allergies?: string[] }
  | { category: 'health'; interests: string[] }

// Physical deletion runs this many days after soft-delete
const PHYSICAL_DELETION_DELAY_DAYS = 30

// ── Reads ─────────────────────────────────────────────────────────

/**
 * Get a single sensitive attribute for a user + category.
 * Returns null if no active (non-deleted) record exists.
 * Logs the access to audit_log for GDPR compliance.
 *
 * NOTE: This returns the ROW including encrypted_value — callers that
 * need the plaintext must call decryptSensitiveAttribute() separately.
 * This separation allows the scoring engine to check existence without
 * always decrypting (avoiding unnecessary key usage).
 */
export async function getSensitiveAttributeRow(
  userId: string,
  attributeCategory: SensitiveAttributeCategory,
  accessedBy: string = 'system'
): Promise<ConsumerSensitiveAttribute | null> {
  const rows = await db
    .select()
    .from(consumerSensitiveAttributes)
    .where(
      and(
        eq(consumerSensitiveAttributes.userId, userId),
        eq(consumerSensitiveAttributes.attributeCategory, attributeCategory),
        isNull(consumerSensitiveAttributes.deletedAt)
      )
    )
    .limit(1)

  if (rows[0]) {
    await logSensitiveDataAccess(
      userId,
      accessedBy,
      'READ_SENSITIVE_ATTRIBUTE',
      { attributeCategory }
    ).catch(console.error)
  }

  return rows[0] ?? null
}

/**
 * Get all active sensitive attributes for a user (metadata only — not decrypted).
 * Used for GDPR Art. 15 right-of-access listing.
 */
export async function listSensitiveAttributeCategories(
  userId: string
): Promise<SensitiveAttributeCategory[]> {
  const rows = await db
    .select({ attributeCategory: consumerSensitiveAttributes.attributeCategory })
    .from(consumerSensitiveAttributes)
    .where(
      and(
        eq(consumerSensitiveAttributes.userId, userId),
        isNull(consumerSensitiveAttributes.deletedAt)
      )
    )

  return rows.map(r => r.attributeCategory as SensitiveAttributeCategory)
}

/**
 * Decrypt and return the plaintext payload for a sensitive attribute.
 * Returns null if no active record exists.
 * Always logs to audit_log.
 */
export async function decryptSensitiveAttribute(
  userId: string,
  attributeCategory: SensitiveAttributeCategory,
  accessedBy: string = 'system'
): Promise<SensitiveAttributePayload | null> {
  const row = await getSensitiveAttributeRow(userId, attributeCategory, accessedBy)
  if (!row) return null

  try {
    const plaintext = await decryptFromStorage(row.encryptedValue, row.encryptionKeyId)
    return plaintext as SensitiveAttributePayload
  } catch (err) {
    console.error(
      `[sensitiveAttributeRepository] Decryption failed for user=${userId} category=${attributeCategory}:`,
      err
    )
    throw new Error(`Failed to decrypt sensitive attribute: ${attributeCategory}`)
  }
}

// ── Writes ────────────────────────────────────────────────────────

/**
 * Save or update a sensitive attribute for a user.
 * Encrypts the payload before storage using the current active key.
 *
 * If a soft-deleted record exists for the same user+category, it is
 * hard-deleted first (consent was re-granted after a prior revocation).
 *
 * Requires a valid consentRecordId — the consent record must exist
 * and be granted before calling this function. The caller (service layer)
 * is responsible for checking consent.
 */
export async function upsertSensitiveAttribute(
  userId: string,
  attributeCategory: SensitiveAttributeCategory,
  payload: Omit<SensitiveAttributePayload, 'category'>,
  consentRecordId: string
): Promise<ConsumerSensitiveAttribute> {
  const { encryptedValue, encryptionKeyId } = await encryptForStorage({
    category: attributeCategory,
    ...payload,
  })

  const now = new Date()

  // Remove any prior soft-deleted record for this user+category
  // so the unique constraint (user_id, attribute_category) WHERE deleted_at IS NULL
  // is satisfied on re-insert after a prior revocation.
  await db
    .delete(consumerSensitiveAttributes)
    .where(
      and(
        eq(consumerSensitiveAttributes.userId, userId),
        eq(consumerSensitiveAttributes.attributeCategory, attributeCategory),
        // Only delete if already soft-deleted — leave active records for upsert
        lt(
          consumerSensitiveAttributes.deletedAt,
          new Date(now.getTime() - 1) // any non-null deletedAt
        )
      )
    )

  const [row] = await db
    .insert(consumerSensitiveAttributes)
    .values({
      userId,
      attributeCategory,
      encryptedValue,
      encryptionKeyId,
      consentRecordId,
    } satisfies Omit<NewConsumerSensitiveAttribute, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>)
    .onConflictDoUpdate({
      target: [
        consumerSensitiveAttributes.userId,
        consumerSensitiveAttributes.attributeCategory,
      ],
      set: {
        encryptedValue,
        encryptionKeyId,
        consentRecordId,
        updatedAt: now,
        deletedAt: null,  // un-delete if record was soft-deleted
      },
    })
    .returning()

  await logSensitiveDataAccess(
    userId,
    'system',
    'WRITE_SENSITIVE_ATTRIBUTE',
    { attributeCategory, encryptionKeyId }
  ).catch(console.error)

  return row
}

// ── Deletion ──────────────────────────────────────────────────────

/**
 * Soft-delete a sensitive attribute for a user + category.
 * Sets deletedAt = NOW(). Physical deletion scheduled after PHYSICAL_DELETION_DELAY_DAYS.
 *
 * Called when:
 *   - User revokes consent for a sensitive_* category
 *   - User explicitly requests deletion of a specific attribute
 */
export async function softDeleteSensitiveAttribute(
  userId: string,
  attributeCategory: SensitiveAttributeCategory
): Promise<void> {
  await db
    .update(consumerSensitiveAttributes)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(consumerSensitiveAttributes.userId, userId),
        eq(consumerSensitiveAttributes.attributeCategory, attributeCategory),
        isNull(consumerSensitiveAttributes.deletedAt)
      )
    )

  await logSensitiveDataAccess(
    userId,
    'system',
    'SOFT_DELETE_SENSITIVE_ATTRIBUTE',
    { attributeCategory }
  ).catch(console.error)
}

/**
 * Soft-delete ALL sensitive attributes for a user.
 * Called on full GDPR/DPDP erasure request.
 * Returns the number of rows soft-deleted.
 */
export async function softDeleteAllSensitiveAttributesForUser(userId: string): Promise<number> {
  const updated = await db
    .update(consumerSensitiveAttributes)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(consumerSensitiveAttributes.userId, userId),
        isNull(consumerSensitiveAttributes.deletedAt)
      )
    )
    .returning({ id: consumerSensitiveAttributes.id })

  await logSensitiveDataAccess(
    userId,
    'system',
    'SOFT_DELETE_ALL_SENSITIVE_ATTRIBUTES',
    { count: updated.length }
  ).catch(console.error)

  return updated.length
}

/**
 * Find rows due for physical deletion (soft-deleted >= PHYSICAL_DELETION_DELAY_DAYS ago).
 * Called by the GDPR erasure cron job.
 */
export async function getAttributesPendingPhysicalDeletion(): Promise<ConsumerSensitiveAttribute[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PHYSICAL_DELETION_DELAY_DAYS)

  return db
    .select()
    .from(consumerSensitiveAttributes)
    .where(lt(consumerSensitiveAttributes.deletedAt, cutoff))
    .limit(500)
}

/**
 * Physically delete a single sensitive attribute row by ID.
 * Only call this after verifying the row has passed the deletion delay.
 * Called by the GDPR erasure cron on rows returned by getAttributesPendingPhysicalDeletion().
 */
export async function physicallyDeleteAttribute(
  attributeId: string,
  userId: string
): Promise<void> {
  await db
    .delete(consumerSensitiveAttributes)
    .where(eq(consumerSensitiveAttributes.id, attributeId))

  await logSensitiveDataAccess(
    userId,
    'cron',
    'PHYSICAL_DELETE_SENSITIVE_ATTRIBUTE',
    { attributeId }
  ).catch(console.error)
}

// ── Key rotation ──────────────────────────────────────────────────

/**
 * Re-encrypt a single sensitive attribute row with a new key ID.
 * Use during key rotation to migrate rows one at a time.
 *
 * Procedure:
 *   1. Decrypt with the row's current encryptionKeyId
 *   2. Re-encrypt with newKeyId
 *   3. Update the row in the DB
 *
 * The calling job should iterate rows WHERE encryption_key_id = oldKeyId
 * and call this function for each one.
 */
export async function rotateAttributeKey(
  attributeId: string,
  userId: string,
  newKeyId: string
): Promise<void> {
  const rows = await db
    .select()
    .from(consumerSensitiveAttributes)
    .where(eq(consumerSensitiveAttributes.id, attributeId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new Error(`Sensitive attribute not found: ${attributeId}`)
  }

  if (row.encryptionKeyId === newKeyId) {
    return  // already on the new key — nothing to do
  }

  const { encryptedValue, encryptionKeyId } = await reEncryptWithNewKey(
    row.encryptedValue,
    row.encryptionKeyId,
    newKeyId
  )

  await db
    .update(consumerSensitiveAttributes)
    .set({ encryptedValue, encryptionKeyId, updatedAt: new Date() })
    .where(eq(consumerSensitiveAttributes.id, attributeId))

  await logSensitiveDataAccess(
    userId,
    'system',
    'KEY_ROTATION_SENSITIVE_ATTRIBUTE',
    { attributeId, oldKeyId: row.encryptionKeyId, newKeyId }
  ).catch(console.error)
}
