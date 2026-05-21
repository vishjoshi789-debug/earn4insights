import 'server-only'

import { db } from '@/db'
import {
  userTotpSecrets,
  userRecoveryCodes,
  trustedDevices,
  users,
  type UserTotpSecret,
  type UserRecoveryCode,
  type TrustedDevice,
} from '@/db/schema'
import { and, desc, eq, lt } from 'drizzle-orm'

/**
 * DB access for two-factor authentication — TOTP secrets, recovery
 * codes, trusted devices, and the users.two_factor_enabled flag.
 * Queries only; all business logic lives in twoFactorService.
 */

// ── TOTP secret ───────────────────────────────────────────────────

export async function getTotpSecret(userId: string): Promise<UserTotpSecret | null> {
  const rows = await db
    .select()
    .from(userTotpSecrets)
    .where(eq(userTotpSecrets.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Insert (or replace) the pending TOTP secret for a user. user_id is
 * UNIQUE, so an abandoned earlier setup is overwritten. Always lands
 * disabled — verifyAndEnable() flips it on.
 */
export async function upsertTotpSecret(data: {
  userId: string
  encryptedSecret: string
  encryptionKeyId: string
}): Promise<void> {
  await db
    .insert(userTotpSecrets)
    .values({
      userId: data.userId,
      encryptedSecret: data.encryptedSecret,
      encryptionKeyId: data.encryptionKeyId,
      isEnabled: false,
    })
    .onConflictDoUpdate({
      target: userTotpSecrets.userId,
      set: {
        encryptedSecret: data.encryptedSecret,
        encryptionKeyId: data.encryptionKeyId,
        isEnabled: false,
        verifiedAt: null,
        lastUsedAt: null,
        updatedAt: new Date(),
      },
    })
}

export async function enableTotpSecret(userId: string): Promise<void> {
  await db
    .update(userTotpSecrets)
    .set({ isEnabled: true, verifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(userTotpSecrets.userId, userId))
}

export async function touchTotpLastUsed(userId: string): Promise<void> {
  await db
    .update(userTotpSecrets)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(userTotpSecrets.userId, userId))
}

export async function deleteTotpSecret(userId: string): Promise<void> {
  await db.delete(userTotpSecrets).where(eq(userTotpSecrets.userId, userId))
}

// ── Recovery codes ────────────────────────────────────────────────

/** Atomically replace a user's recovery codes with a fresh hashed set. */
export async function replaceRecoveryCodes(
  userId: string,
  codeHashes: string[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId))
    if (codeHashes.length > 0) {
      await tx
        .insert(userRecoveryCodes)
        .values(codeHashes.map((codeHash) => ({ userId, codeHash })))
    }
  })
}

export async function getUnusedRecoveryCodes(userId: string): Promise<UserRecoveryCode[]> {
  return db
    .select()
    .from(userRecoveryCodes)
    .where(and(eq(userRecoveryCodes.userId, userId), eq(userRecoveryCodes.isUsed, false)))
}

export async function countUnusedRecoveryCodes(userId: string): Promise<number> {
  const rows = await db
    .select({ id: userRecoveryCodes.id })
    .from(userRecoveryCodes)
    .where(and(eq(userRecoveryCodes.userId, userId), eq(userRecoveryCodes.isUsed, false)))
  return rows.length
}

export async function markRecoveryCodeUsed(id: string): Promise<void> {
  await db
    .update(userRecoveryCodes)
    .set({ isUsed: true, usedAt: new Date() })
    .where(eq(userRecoveryCodes.id, id))
}

export async function deleteRecoveryCodes(userId: string): Promise<void> {
  await db.delete(userRecoveryCodes).where(eq(userRecoveryCodes.userId, userId))
}

// ── Trusted devices ───────────────────────────────────────────────

export async function insertTrustedDevice(data: {
  userId: string
  deviceFingerprint: string
  deviceName: string
  expiresAt: Date
}): Promise<TrustedDevice> {
  const [row] = await db.insert(trustedDevices).values(data).returning()
  return row
}

export async function findTrustedDevice(
  userId: string,
  deviceFingerprint: string,
): Promise<TrustedDevice | null> {
  const rows = await db
    .select()
    .from(trustedDevices)
    .where(
      and(
        eq(trustedDevices.userId, userId),
        eq(trustedDevices.deviceFingerprint, deviceFingerprint),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function touchTrustedDevice(id: string): Promise<void> {
  await db
    .update(trustedDevices)
    .set({ lastUsedAt: new Date() })
    .where(eq(trustedDevices.id, id))
}

export async function deleteTrustedDevice(id: string): Promise<void> {
  await db.delete(trustedDevices).where(eq(trustedDevices.id, id))
}

/** Delete one device scoped to its owner. Returns true if a row was removed. */
export async function deleteTrustedDeviceForUser(
  userId: string,
  id: string,
): Promise<boolean> {
  const removed = await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.id, id), eq(trustedDevices.userId, userId)))
    .returning({ id: trustedDevices.id })
  return removed.length > 0
}

export async function listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  return db
    .select()
    .from(trustedDevices)
    .where(eq(trustedDevices.userId, userId))
    .orderBy(desc(trustedDevices.lastUsedAt))
}

export async function deleteAllTrustedDevices(userId: string): Promise<void> {
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId))
}

/** Delete every expired trusted device. Returns the number removed. */
export async function deleteExpiredTrustedDevices(): Promise<number> {
  const removed = await db
    .delete(trustedDevices)
    .where(lt(trustedDevices.expiresAt, new Date()))
    .returning({ id: trustedDevices.id })
  return removed.length
}

// ── users.two_factor_enabled ──────────────────────────────────────

export async function setUserTwoFactorEnabled(
  userId: string,
  enabled: boolean,
): Promise<void> {
  await db
    .update(users)
    .set({ twoFactorEnabled: enabled, updatedAt: new Date() })
    .where(eq(users.id, userId))
}
