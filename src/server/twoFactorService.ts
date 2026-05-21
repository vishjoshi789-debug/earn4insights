import 'server-only'

import { getUserById } from '@/lib/user/userStore'
import { verifyPassword } from '@/lib/user/password'
import { encryptForStorage, decryptFromStorage } from '@/lib/encryption'
import {
  generateTotpSecret,
  buildOtpAuthUri,
  buildQrCodeDataUrl,
  verifyTotpCode,
} from '@/lib/twoFactor/totp'
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  matchesRecoveryCode,
} from '@/lib/twoFactor/recoveryCodes'
import {
  generateDeviceToken,
  fingerprintToken,
  signDeviceCookie,
  readDeviceCookie,
  parseDeviceName,
  TRUSTED_DEVICE_TTL_DAYS,
} from '@/lib/twoFactor/devices'
import * as repo from '@/db/repositories/twoFactorRepository'

/**
 * Two-factor authentication (TOTP) business logic.
 *
 * The TOTP secret is AES-256-GCM encrypted via the versioned encryption
 * system (encryption_key_id stored alongside). Recovery codes are
 * bcrypt-hashed. Trusted devices are identified by a signed cookie token.
 */

export class TwoFactorError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message)
    this.name = 'TwoFactorError'
  }
}

export type SetupResult = { qrCodeDataUrl: string; secret: string }
export type EnableResult =
  | { success: true; recoveryCodes: string[] }
  | { success: false; error: string }
export type DisableResult = { success: true } | { success: false; error: string }
export type RegenerateResult =
  | { success: true; recoveryCodes: string[] }
  | { success: false; error: string }
export type TrustDeviceResult = {
  deviceId: string
  deviceName: string
  cookieValue: string
  expiresAt: Date
}

/**
 * Begin 2FA setup: generate a secret, persist it encrypted + disabled,
 * and return a QR code plus the base32 secret for manual entry. 2FA is
 * NOT active yet — the user must confirm a code via verifyAndEnable().
 */
export async function generateSetup(userId: string): Promise<SetupResult> {
  const user = await getUserById(userId)
  if (!user) throw new TwoFactorError('User not found.', 'user_not_found')

  const existing = await repo.getTotpSecret(userId)
  if (existing?.isEnabled) {
    throw new TwoFactorError(
      'Two-factor authentication is already enabled.',
      'already_enabled',
    )
  }

  const secret = generateTotpSecret()
  const { encryptedValue, encryptionKeyId } = await encryptForStorage(secret)
  await repo.upsertTotpSecret({ userId, encryptedSecret: encryptedValue, encryptionKeyId })

  const otpAuthUri = buildOtpAuthUri(secret, user.email)
  const qrCodeDataUrl = await buildQrCodeDataUrl(otpAuthUri)
  return { qrCodeDataUrl, secret }
}

/**
 * Confirm the first TOTP code and switch 2FA on. Generates 10 recovery
 * codes (returned in plaintext exactly once) and stores their hashes.
 */
export async function verifyAndEnable(
  userId: string,
  totpCode: string,
): Promise<EnableResult> {
  const row = await repo.getTotpSecret(userId)
  if (!row) return { success: false, error: 'Start 2FA setup first.' }
  if (row.isEnabled) {
    return { success: false, error: 'Two-factor authentication is already enabled.' }
  }

  const secret: string = await decryptFromStorage(row.encryptedSecret, row.encryptionKeyId)
  if (!verifyTotpCode(secret, totpCode)) {
    return { success: false, error: 'Invalid code' }
  }

  await repo.enableTotpSecret(userId)
  await repo.setUserTwoFactorEnabled(userId, true)

  const recoveryCodes = generateRecoveryCodes()
  const hashes = await Promise.all(recoveryCodes.map(hashRecoveryCode))
  await repo.replaceRecoveryCodes(userId, hashes)

  return { success: true, recoveryCodes }
}

/** Validate a TOTP code during a login challenge. */
export async function verifyCode(userId: string, code: string): Promise<boolean> {
  const row = await repo.getTotpSecret(userId)
  if (!row || !row.isEnabled) return false

  const secret: string = await decryptFromStorage(row.encryptedSecret, row.encryptionKeyId)
  if (!verifyTotpCode(secret, code)) return false

  await repo.touchTotpLastUsed(userId)
  return true
}

/**
 * Validate a single-use recovery code during a login challenge. On a
 * match the code is burned (marked used) and can never be reused.
 */
export async function verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
  const unused = await repo.getUnusedRecoveryCodes(userId)
  for (const row of unused) {
    if (await matchesRecoveryCode(code, row.codeHash)) {
      await repo.markRecoveryCodeUsed(row.id)
      return true
    }
  }
  return false
}

/** Count a user's remaining unused recovery codes. */
export async function countRemainingRecoveryCodes(userId: string): Promise<number> {
  return repo.countUnusedRecoveryCodes(userId)
}

/**
 * Disable 2FA. Requires the account password as a second confirmation,
 * then wipes the secret, recovery codes, and every trusted device.
 */
export async function disable2FA(
  userId: string,
  password: string,
): Promise<DisableResult> {
  const user = await getUserById(userId)
  if (!user) return { success: false, error: 'User not found.' }
  if (!user.passwordHash) {
    return {
      success: false,
      error: 'Password confirmation is unavailable for this account.',
    }
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return { success: false, error: 'Incorrect password.' }
  }

  await repo.deleteTotpSecret(userId)
  await repo.deleteRecoveryCodes(userId)
  await repo.deleteAllTrustedDevices(userId)
  await repo.setUserTwoFactorEnabled(userId, false)
  return { success: true }
}

/**
 * Replace all recovery codes with a fresh set. Requires a current TOTP
 * code as confirmation. New codes are returned in plaintext once.
 */
export async function regenerateRecoveryCodes(
  userId: string,
  totpCode: string,
): Promise<RegenerateResult> {
  const row = await repo.getTotpSecret(userId)
  if (!row || !row.isEnabled) {
    return { success: false, error: 'Two-factor authentication is not enabled.' }
  }
  const secret: string = await decryptFromStorage(row.encryptedSecret, row.encryptionKeyId)
  if (!verifyTotpCode(secret, totpCode)) {
    return { success: false, error: 'Invalid code' }
  }

  const recoveryCodes = generateRecoveryCodes()
  const hashes = await Promise.all(recoveryCodes.map(hashRecoveryCode))
  await repo.replaceRecoveryCodes(userId, hashes)
  return { success: true, recoveryCodes }
}

/**
 * Mark the current device trusted for 30 days. Returns the value to
 * write into the `e4i-trusted-device` cookie — the caller (a route that
 * owns a response) is responsible for actually setting the cookie.
 */
export async function trustDevice(
  userId: string,
  userAgent: string | null,
): Promise<TrustDeviceResult> {
  const token = generateDeviceToken()
  const deviceName = parseDeviceName(userAgent)
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_DAYS * 24 * 60 * 60 * 1000)
  const device = await repo.insertTrustedDevice({
    userId,
    deviceFingerprint: fingerprintToken(token),
    deviceName,
    expiresAt,
  })
  return { deviceId: device.id, deviceName, cookieValue: signDeviceCookie(token), expiresAt }
}

/**
 * Is the caller's device trusted? `deviceCookieValue` is the raw
 * `e4i-trusted-device` cookie value. Expired matches are deleted and
 * treated as untrusted.
 */
export async function isDeviceTrusted(
  userId: string,
  deviceCookieValue: string | null,
): Promise<boolean> {
  const token = readDeviceCookie(deviceCookieValue)
  if (!token) return false

  const device = await repo.findTrustedDevice(userId, fingerprintToken(token))
  if (!device) return false

  if (device.expiresAt.getTime() < Date.now()) {
    await repo.deleteTrustedDevice(device.id)
    return false
  }
  await repo.touchTrustedDevice(device.id)
  return true
}

/** Delete every expired trusted device. Returns the count removed. */
export async function cleanupExpiredDevices(): Promise<number> {
  return repo.deleteExpiredTrustedDevices()
}

export type TrustedDeviceView = {
  id: string
  deviceName: string
  lastUsedAt: string
  expiresAt: string
  createdAt: string
  isCurrent: boolean
}

/**
 * List a user's trusted devices for the settings UI. `deviceCookieValue`
 * (the raw `e4i-trusted-device` cookie) lets us flag the device the
 * request is coming from.
 */
export async function listTrustedDevices(
  userId: string,
  deviceCookieValue: string | null,
): Promise<TrustedDeviceView[]> {
  const currentToken = readDeviceCookie(deviceCookieValue)
  const currentFingerprint = currentToken ? fingerprintToken(currentToken) : null

  const devices = await repo.listTrustedDevices(userId)
  return devices.map((d) => ({
    id: d.id,
    deviceName: d.deviceName,
    lastUsedAt: d.lastUsedAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    isCurrent: currentFingerprint !== null && d.deviceFingerprint === currentFingerprint,
  }))
}

/** Remove one trusted device, scoped to its owner. False if not found. */
export async function removeTrustedDevice(userId: string, deviceId: string): Promise<boolean> {
  return repo.deleteTrustedDeviceForUser(userId, deviceId)
}

export type TwoFactorStatus = {
  enabled: boolean
  /** Whether the account has a password — 2FA setup is offered only to password accounts. */
  passwordSet: boolean
  verifiedAt: string | null
  lastUsedAt: string | null
  recoveryCodesRemaining: number
}

/** Current 2FA state for the settings UI. */
export async function getTwoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const [user, row] = await Promise.all([getUserById(userId), repo.getTotpSecret(userId)])
  const enabled = Boolean(row?.isEnabled)
  return {
    enabled,
    passwordSet: Boolean(user?.passwordHash),
    verifiedAt: row?.verifiedAt ? row.verifiedAt.toISOString() : null,
    lastUsedAt: row?.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    recoveryCodesRemaining: enabled ? await repo.countUnusedRecoveryCodes(userId) : 0,
  }
}
